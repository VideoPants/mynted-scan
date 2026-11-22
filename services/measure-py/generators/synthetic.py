from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "generated" / "synthetic"


def render_card(
    borders: dict[str, float],
    seed: int,
    px_per_mm: float = 20.0,
) -> tuple[np.ndarray, dict]:
    rng = np.random.default_rng(seed)
    w = int(63 * px_per_mm)
    h = int(88 * px_per_mm)
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    # Yellow border
    canvas[:] = (0, 200, 255)
    inner = (
        int(borders["L"] * px_per_mm),
        int(borders["T"] * px_per_mm),
        w - int(borders["R"] * px_per_mm),
        h - int(borders["B"] * px_per_mm),
    )
    art = (
        int(rng.integers(40, 200)),
        int(rng.integers(40, 200)),
        int(rng.integers(40, 200)),
    )
    canvas[inner[1] : inner[3], inner[0] : inner[2]] = art
    # Rounded corners approx
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (8, 8), (w - 9, h - 9), 255, -1)
    canvas = cv2.bitwise_and(canvas, canvas, mask=mask)

    # Composite onto background with mild warp
    bg = np.full((h + 120, w + 120, 3), int(rng.integers(10, 40)), dtype=np.uint8)
    x0, y0 = 60, 60
    bg[y0 : y0 + h, x0 : x0 + w] = canvas

    src = np.array(
        [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]],
        dtype=np.float32,
    )
    # Mild perspective only — keeps classical detector within a few pixels
    jitter = rng.uniform(-3, 3, size=src.shape).astype(np.float32)
    dst = src + jitter
    H = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(bg, H, (bg.shape[1], bg.shape[0]))
    # Also keep a clean crop used for unit GT checks
    clean = canvas.copy()

    lr = max(borders["L"], borders["R"]) / (borders["L"] + borders["R"]) * 100
    tb = max(borders["T"], borders["B"]) / (borders["T"] + borders["B"]) * 100
    gt = {
        "gtType": "synthetic",
        "bordersMm": borders,
        "lrRatio": lr,
        "tbRatio": tb,
        "seed": seed,
    }
    gt["cleanBordersMm"] = borders
    return warped, gt, clean


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    for split, n in (("train", args.count // 2), ("dev", args.count // 4), ("test", args.count - args.count // 2 - args.count // 4)):
        out = OUT / split
        out.mkdir(parents=True, exist_ok=True)
        for i in range(n):
            seed = args.seed + i + hash(split) % 10000
            # Known offsets
            L = round(rng.uniform(2.2, 4.2), 2)
            R = round(6.0 - L, 2)
            T = round(rng.uniform(2.2, 4.2), 2)
            B = round(6.0 - T, 2)
            borders = {"L": L, "R": R, "T": T, "B": B}
            img, gt, clean = render_card(borders, seed)
            stem = f"syn_{split}_{i:03d}"
            cv2.imwrite(str(out / f"{stem}.png"), img)
            cv2.imwrite(str(out / f"{stem}_clean.png"), clean)
            (out / f"{stem}.json").write_text(json.dumps(gt, indent=2))
    print(f"Wrote synthetic samples under {OUT}")


if __name__ == "__main__":
    main()