#!/usr/bin/env node
/**
 * Measure one PNG, or run the synthetic fixture table when given --table.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cvFactory from "@techstark/opencv-js";
import { measureImagePixels } from "../dist/image-pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];

async function loadCv() {
  const cv = await cvFactory;
  await new Promise((resolve) => {
    if (cv.getBuildInformation) resolve();
    else cv.onRuntimeInitialized = () => resolve();
  });
  return cv;
}

function loadPngRgba(pngPath) {
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
    { stdio: "pipe" },
  );
  const [width, height] = readFileSync(metaPath, "utf8").trim().split(" ").map(Number);
  const buf = readFileSync(rawPath);
  unlinkSync(metaPath);
  unlinkSync(rawPath);
  return {
    data: new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength),
    width,
    height,
  };
}

async function measureOne(cv, pngPath) {
  const img = loadPngRgba(pngPath);
  return measureImagePixels(cv, img, {
    face: "FRONT",
    openCvLoaded: true,
    captureSource: "UPLOAD",
  });
}

if (arg === "--table") {
  const fixturesDir = join(__dirname, "../test/fixtures");
  const generatedDir = join(fixturesDir, "generated");
  execFileSync("node", [join(fixturesDir, "gen-synthetic.mjs")], { stdio: "inherit" });
  const cases = JSON.parse(readFileSync(join(generatedDir, "cases.json"), "utf8"));
  const cv = await loadCv();
  console.log(
    [
      "case".padEnd(12),
      "exp LR".padEnd(10),
      "meas LR".padEnd(10),
      "exp TB".padEnd(10),
      "meas TB".padEnd(10),
      "status".padEnd(14),
      "dLR",
      "dTB",
    ].join(" "),
  );
  for (const c of cases) {
    const path = join(generatedDir, `${c.id}.png`);
    if (!existsSync(path)) continue;
    const report = await measureOne(cv, path);
    const leftPct = (report.bordersMm.L / (report.bordersMm.L + report.bordersMm.R)) * 100;
    const topPct = (report.bordersMm.T / (report.bordersMm.T + report.bordersMm.B)) * 100;
    const measLR = `${leftPct.toFixed(1)}/${(100 - leftPct).toFixed(1)}`;
    const measTB = `${topPct.toFixed(1)}/${(100 - topPct).toFixed(1)}`;
    const expLR = `${c.leftPct}/${c.rightPct}`;
    const expTB = `${c.topPct}/${c.bottomPct}`;
    const dLR = (leftPct - c.leftPct).toFixed(1);
    const dTB = (topPct - c.topPct).toFixed(1);
    console.log(
      [
        c.id.padEnd(12),
        expLR.padEnd(10),
        measLR.padEnd(10),
        expTB.padEnd(10),
        measTB.padEnd(10),
        String(report.status).padEnd(14),
        dLR.padStart(5),
        dTB.padStart(5),
      ].join(" "),
    );
  }
  process.exit(0);
}

if (!arg) {
  console.error("usage: measure-png.mjs <path.png> | --table");
  process.exit(1);
}

const cv = await loadCv();
const report = await measureOne(cv, arg);
console.log(
  JSON.stringify(
    {
      bordersMm: report.bordersMm,
      lrRaw: report.lrRatio.raw,
      tbRaw: report.tbRatio.raw,
      status: report.status,
      confidence: report.confidence,
      uncertaintyPp: report.uncertaintyPp,
    },
    null,
    2,
  ),
);
