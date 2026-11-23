import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { measureImagePixels } from "./image-pipeline.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");
const generatedDir = join(fixturesDir, "generated");

async function loadPngRgba(pngPath: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const rawPath = join(tmpdir(), `mynted-test-${process.pid}-${Math.random().toString(16).slice(2)}.bin`);
  const metaPath = join(tmpdir(), `mynted-test-${process.pid}-${Math.random().toString(16).slice(2)}.txt`);
  execFileSync(
    "python3",
    [
      "-c",
      `
import cv2, sys
im = cv2.imread(sys.argv[1])
assert im is not None
rgba = cv2.cvtColor(im, cv2.COLOR_BGR2RGBA)
open(sys.argv[2], "wb").write(rgba.tobytes())
open(sys.argv[3], "w").write(f"{im.shape[1]} {im.shape[0]}")
`,
      pngPath,
      rawPath,
      metaPath,
    ],
    { stdio: "pipe" },
  );
  const [width, height] = readFileSync(metaPath, "utf8").trim().split(" ").map(Number);
  const buf = readFileSync(rawPath);
  unlinkSync(rawPath);
  unlinkSync(metaPath);
  return {
    data: new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength),
    width: width!,
    height: height!,
  };
}

function writeKnownCard(
  path: string,
  borders: { L: number; R: number; T: number; B: number },
): void {
  const script = `
import cv2, numpy as np, sys
px=20; w,h=63*px,88*px
L,R,T,B=float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4]),float(sys.argv[5])
canvas=np.zeros((h,w,3),np.uint8); canvas[:]= (210,220,235)
l,r,t,b=int(round(L*px)),int(round(R*px)),int(round(T*px)),int(round(B*px))
canvas[t:h-b, l:w-r]=(40,200,240)
canvas[t+2:h-b-2, l+2:w-r-2]=(40,30,50)
cv2.imwrite(sys.argv[1], canvas)
`;
  execFileSync(
    "python3",
    ["-c", script, path, String(borders.L), String(borders.R), String(borders.T), String(borders.B)],
    { stdio: "pipe" },
  );
}

async function loadCv(): Promise<Parameters<typeof measureImagePixels>[0]> {
  const cvFactory = require("@techstark/opencv-js") as Promise<unknown> | { then?: unknown };
  const cv = (await Promise.resolve(cvFactory)) as {
    getBuildInformation?: unknown;
    onRuntimeInitialized?: () => void;
    Mat: unknown;
  };
  await new Promise<void>((resolve) => {
    if (cv.getBuildInformation || cv.Mat) resolve();
    else cv.onRuntimeInitialized = () => resolve();
  });
  return cv as Parameters<typeof measureImagePixels>[0];
}

describe("image pipeline known offsets", () => {
  it("measures distinct known LR offsets within 1 pp and never stubs 50/50 for 60/40", async () => {
    const cv = await loadCv();
    const dir = join(tmpdir(), `mynted-cards-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const cases = [
      { name: "60_40", L: 3.6, R: 2.4, T: 3.0, B: 3.0, lr: 60 },
      { name: "55_45", L: 3.3, R: 2.7, T: 3.0, B: 3.0, lr: 55 },
      { name: "70_30", L: 4.2, R: 1.8, T: 3.0, B: 3.0, lr: 70 },
    ] as const;

    const measured: number[] = [];
    for (const c of cases) {
      const path = join(dir, `${c.name}.png`);
      writeKnownCard(path, c);
      const img = await loadPngRgba(path);
      const report = measureImagePixels(cv, img, {
        face: "FRONT",
        openCvLoaded: true,
        captureSource: "UPLOAD",
      });
      expect(report.status).toBe("OK");
      expect(report.quality?.openCvLoaded).toBe(true);
      expect(Math.abs(report.lrRatio.raw - c.lr)).toBeLessThanOrEqual(1);
      measured.push(report.lrRatio.raw);
    }

    expect(new Set(measured.map((v) => v.toFixed(1))).size).toBe(cases.length);
    expect(measured[0]).not.toBe(50);
  }, 120_000);
});

describe("synthetic warped fixtures ±1 pp", () => {
  beforeAll(() => {
    execFileSync("node", [join(fixturesDir, "gen-synthetic.mjs")], {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    });
  }, 60_000);

  it("measures every case within ±1 pp and ±0.1 mm, all OK, unique outputs", async () => {
    const cv = await loadCv();
    const cases = JSON.parse(readFileSync(join(generatedDir, "cases.json"), "utf8")) as Array<{
      id: string;
      L: number;
      R: number;
      T: number;
      B: number;
      leftPct: number;
      rightPct: number;
      topPct: number;
      bottomPct: number;
    }>;

    const signatures: string[] = [];
    for (const c of cases) {
      const path = join(generatedDir, `${c.id}.png`);
      expect(existsSync(path)).toBe(true);
      const img = await loadPngRgba(path);
      const report = measureImagePixels(cv, img, {
        face: "FRONT",
        openCvLoaded: true,
        captureSource: "UPLOAD",
      });

      expect(report.status, c.id).toBe("OK");
      expect(Math.abs(report.bordersMm.L - c.L), `${c.id} L`).toBeLessThanOrEqual(0.1);
      expect(Math.abs(report.bordersMm.R - c.R), `${c.id} R`).toBeLessThanOrEqual(0.1);
      expect(Math.abs(report.bordersMm.T - c.T), `${c.id} T`).toBeLessThanOrEqual(0.1);
      expect(Math.abs(report.bordersMm.B - c.B), `${c.id} B`).toBeLessThanOrEqual(0.1);

      const leftPct =
        (report.bordersMm.L / (report.bordersMm.L + report.bordersMm.R)) * 100;
      const topPct =
        (report.bordersMm.T / (report.bordersMm.T + report.bordersMm.B)) * 100;
      expect(Math.abs(leftPct - c.leftPct), `${c.id} LR`).toBeLessThanOrEqual(1);
      expect(Math.abs(topPct - c.topPct), `${c.id} TB`).toBeLessThanOrEqual(1);

      signatures.push(
        `${leftPct.toFixed(2)}/${(100 - leftPct).toFixed(2)}|${topPct.toFixed(2)}/${(100 - topPct).toFixed(2)}`,
      );
    }

    // Identical-output check: distinct fixtures must not collapse.
    expect(new Set(signatures).size).toBe(cases.length);
  }, 180_000);
});
