#!/usr/bin/env node
/**
 * Generate warped synthetic cards for accuracy regression.
 * Output: packages/centering-core/test/fixtures/generated/ (gitignored)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "generated");
mkdirSync(outDir, { recursive: true });

/**
 * Borders sum to 6 mm per axis.
 * leftPct/rightPct/topPct/bottomPct are the expected display percentages.
 */
export const CASES = [
  { id: "c50", L: 3.0, R: 3.0, T: 3.0, B: 3.0, leftPct: 50, rightPct: 50, topPct: 50, bottomPct: 50, seed: 50, tilt: 18 },
  { id: "c55", L: 3.3, R: 2.7, T: 2.7, B: 3.3, leftPct: 55, rightPct: 45, topPct: 45, bottomPct: 55, seed: 55, tilt: 20 },
  { id: "c60", L: 3.6, R: 2.4, T: 2.4, B: 3.6, leftPct: 60, rightPct: 40, topPct: 40, bottomPct: 60, seed: 60, tilt: 22 },
  { id: "c65", L: 3.9, R: 2.1, T: 2.1, B: 3.9, leftPct: 65, rightPct: 35, topPct: 35, bottomPct: 65, seed: 65, tilt: 20 },
  { id: "c70", L: 4.2, R: 1.8, T: 1.8, B: 4.2, leftPct: 70, rightPct: 30, topPct: 30, bottomPct: 70, seed: 70, tilt: 18 },
  { id: "c40_55", L: 2.4, R: 3.6, T: 3.3, B: 2.7, leftPct: 40, rightPct: 60, topPct: 55, bottomPct: 45, seed: 4055, tilt: 22 },
  { id: "c45_65", L: 2.7, R: 3.3, T: 3.9, B: 2.1, leftPct: 45, rightPct: 55, topPct: 65, bottomPct: 35, seed: 4565, tilt: 20 },
  { id: "prev-60-40", L: 3.6, R: 2.4, T: 3.0, B: 3.0, leftPct: 60, rightPct: 40, topPct: 50, bottomPct: 50, seed: 6040, tilt: 12 },
];

/** PSA-like plastic slab (~80×133 mm) with label band + nested card. */
export const SLAB_CASES = [
  {
    id: "slab-c60",
    kind: "slab",
    L: 3.6,
    R: 2.4,
    T: 2.4,
    B: 3.6,
    leftPct: 60,
    rightPct: 40,
    topPct: 40,
    bottomPct: 60,
    seed: 860,
    tilt: 10,
  },
  {
    id: "slab-c50",
    kind: "slab",
    L: 3.0,
    R: 3.0,
    T: 3.0,
    B: 3.0,
    leftPct: 50,
    rightPct: 50,
    topPct: 50,
    bottomPct: 50,
    seed: 850,
    tilt: 8,
  },
];

const py = `
import cv2, numpy as np, json, sys, os

out_dir = sys.argv[1]
payload = json.loads(sys.argv[2])
cases = payload["cases"]
slab_cases = payload["slabCases"]
px = 20
cw, ch = 63 * px, 88 * px
# Slab must fit on the canvas with margin (80×133 mm → scale down if needed).
bg_w, bg_h = 1600, 2400
sw, sh = 80 * px, 133 * px
scale = min((bg_w * 0.72) / sw, (bg_h * 0.72) / sh)
sw, sh = int(sw * scale), int(sh * scale)
cw_s, ch_s = int(cw * scale), int(ch * scale)

def make_card(L, R, T, B):
    # Cream border + bright yellow frame line (strong luma step) + dark art.
    cream = (200, 215, 230)   # BGR ~ luma 215
    frame = (20, 40, 220)     # reddish-yellow line with lower luma ~70 for clear edge
    art = (35, 28, 45)
    card = np.zeros((ch, cw, 3), np.uint8)
    card[:] = cream
    l, r, t, b = int(round(L*px)), int(round(R*px)), int(round(T*px)), int(round(B*px))
    # Strong edge at exact border: dark frame line then art
    card[t:ch-b, l:cw-r] = frame
    inset = 2
    card[t+inset:ch-b-inset, l+inset:cw-r-inset] = art
    noise = np.random.RandomState(0).randint(0, 20, (ch, cw), np.uint8)
    art_mask = np.zeros((ch, cw), bool)
    art_mask[t+inset:ch-b-inset, l+inset:cw-r-inset] = True
    for c in range(3):
        chn = card[:,:,c].astype(np.int16)
        chn[art_mask] = np.clip(chn[art_mask] + noise[art_mask]//2, 0, 255)
        card[:,:,c] = chn.astype(np.uint8)
    return card

def make_slab(L, R, T, B):
    # Plastic case with red-bordered label on top + nested card (scaled to fit bg).
    slab = np.zeros((sh, sw, 3), np.uint8)
    slab[:] = (210, 215, 220)
    label_h = max(24, int(18 * px * scale))
    slab[0:label_h, :] = (245, 248, 250)
    cv2.rectangle(slab, (4, 4), (sw - 5, label_h - 5), (40, 40, 200), 3)
    card = make_card(L, R, T, B)
    card = cv2.resize(card, (cw_s, ch_s), interpolation=cv2.INTER_AREA)
    ox = (sw - cw_s) // 2
    oy = label_h + (sh - label_h - ch_s) // 2
    slab[oy:oy+ch_s, ox:ox+cw_s] = card
    # Soft plastic edge
    cv2.rectangle(slab, (1, 1), (sw - 2, sh - 2), (160, 165, 170), 2)
    return slab

def warp_onto_bg(card, seed, tilt, card_w=None, card_h=None):
    rng = np.random.RandomState(seed)
    bg = np.zeros((bg_h, bg_w, 3), np.uint8)
    bg[:] = (18, 16, 14)
    noise = rng.randint(0, 40, (bg_h, bg_w, 3), np.uint8)
    bg = cv2.add(bg, noise // 3)

    tw = card_w if card_w is not None else card.shape[1]
    th = card_h if card_h is not None else card.shape[0]
    ox = (bg_w - tw) // 2
    oy = (bg_h - th) // 2
    src = np.float32([[0,0],[tw-1,0],[tw-1,th-1],[0,th-1]])
    base = np.float32([
        [ox, oy],
        [ox + tw - 1, oy],
        [ox + tw - 1, oy + th - 1],
        [ox, oy + th - 1],
    ])
    dst = base + np.float32([
        [rng.randint(-tilt, tilt+1), rng.randint(-tilt, tilt+1)],
        [rng.randint(-tilt, tilt+1), rng.randint(-tilt, tilt+1)],
        [rng.randint(-tilt, tilt+1), rng.randint(-tilt, tilt+1)],
        [rng.randint(-tilt, tilt+1), rng.randint(-tilt, tilt+1)],
    ])
    H = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(card, H, (bg_w, bg_h))
    mask = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY) > 8
    out = bg.copy()
    out[mask] = warped[mask]
    out = cv2.GaussianBlur(out, (3, 3), 0.6)
    return out

manifest = []
for c in cases:
    card = make_card(c["L"], c["R"], c["T"], c["B"])
    img = warp_onto_bg(card, c["seed"], c.get("tilt", 20))
    path = os.path.join(out_dir, c["id"] + ".png")
    cv2.imwrite(path, img)
    manifest.append({**c, "file": c["id"] + ".png"})
    print("wrote", path)

for c in slab_cases:
    slab = make_slab(c["L"], c["R"], c["T"], c["B"])
    img = warp_onto_bg(slab, c["seed"], c.get("tilt", 10), sw, sh)
    path = os.path.join(out_dir, c["id"] + ".png")
    cv2.imwrite(path, img)
    manifest.append({**c, "file": c["id"] + ".png"})
    print("wrote", path)

with open(os.path.join(out_dir, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
with open(os.path.join(out_dir, "slab-cases.json"), "w") as f:
    json.dump(slab_cases, f, indent=2)
`;

execFileSync(
  "python3",
  ["-c", py, outDir, JSON.stringify({ cases: CASES, slabCases: SLAB_CASES })],
  { stdio: "inherit" },
);
writeFileSync(join(outDir, "cases.json"), JSON.stringify(CASES, null, 2));
writeFileSync(join(outDir, "slab-cases.json"), JSON.stringify(SLAB_CASES, null, 2));
console.log(`Generated ${CASES.length} card + ${SLAB_CASES.length} slab fixtures in ${outDir}`);
