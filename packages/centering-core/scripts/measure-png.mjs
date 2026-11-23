#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cvFactory from "@techstark/opencv-js";
import { measureImagePixels } from "../dist/image-pipeline.js";

const pngPath = process.argv[2];
if (!pngPath) {
  console.error("usage: measure-png.mjs <path.png>");
  process.exit(1);
}

const metaPath = join(tmpdir(), `mynted-meta-${process.pid}.txt`);
const rawPath = join(tmpdir(), `mynted-raw-${process.pid}.bin`);
execFileSync(
  "python3",
  [
    "-c",
    `
import cv2, sys
im = cv2.imread(sys.argv[1])
if im is None:
  raise SystemExit('read failed')
rgba = cv2.cvtColor(im, cv2.COLOR_BGR2RGBA)
open(sys.argv[2], 'wb').write(rgba.tobytes())
open(sys.argv[3], 'w').write(f'{im.shape[1]} {im.shape[0]}')
`,
    pngPath,
    rawPath,
    metaPath,
  ],
  { stdio: "inherit" },
);

const [width, height] = (await import("node:fs")).readFileSync(metaPath, "utf8").trim().split(" ").map(Number);
const buf = (await import("node:fs")).readFileSync(rawPath);
unlinkSync(metaPath);
unlinkSync(rawPath);
const data = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);

const cv = await cvFactory;
await new Promise((resolve) => {
  if (cv.getBuildInformation) resolve();
  else cv.onRuntimeInitialized = () => resolve();
});

const report = measureImagePixels(
  cv,
  { data, width, height },
  { face: "FRONT", openCvLoaded: true, captureSource: "UPLOAD" },
);
console.log(
  JSON.stringify(
    {
      bordersMm: report.bordersMm,
      lrRaw: report.lrRatio.raw,
      tbRaw: report.tbRatio.raw,
      status: report.status,
      confidence: report.confidence,
    },
    null,
    2,
  ),
);
