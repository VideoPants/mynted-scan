import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { measureImagePixels } from "./image-pipeline.js";

const require = createRequire(import.meta.url);

async function loadPngRgba(pngPath: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const rawPath = join(tmpdir(), `mynted-test-${process.pid}.bin`);
  const metaPath = join(tmpdir(), `mynted-test-${process.pid}.txt`);
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
canvas=np.zeros((h,w,3),np.uint8); canvas[:]= (0,200,255)
canvas[int(T*px):h-int(B*px), int(L*px):w-int(R*px)]=(80,40,160)
cv2.imwrite(sys.argv[1], canvas)
`;
  execFileSync(
    "python3",
    ["-c", script, path, String(borders.L), String(borders.R), String(borders.T), String(borders.B)],
    { stdio: "pipe" },
  );
}

describe("image pipeline known offsets", () => {
  it("measures distinct known LR offsets within 1 pp and never stubs 50/50 for 60/40", async () => {
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

    // Uniqueness: different offsets must not collapse to the same stub.
    expect(new Set(measured.map((v) => v.toFixed(1))).size).toBe(cases.length);
    expect(measured[0]).not.toBe(50);
  }, 120_000);
});
