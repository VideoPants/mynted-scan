#!/usr/bin/env node
/**
 * Idempotent copy of Apache-2.0 OpenCV.js into apps/web/public/opencv/
 * for the classic measure worker (importScripts). Binaries stay gitignored.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function resolveOpenCv() {
  try {
    const pkgDir = dirname(require.resolve("@techstark/opencv-js/package.json"));
    const candidate = join(pkgDir, "dist", "opencv.js");
    if (existsSync(candidate)) return candidate;
  } catch {
    // fall through
  }
  const fallback = join(root, "node_modules", "@techstark", "opencv-js", "dist", "opencv.js");
  if (existsSync(fallback)) return fallback;
  throw new Error("copy-opencv: @techstark/opencv-js dist/opencv.js not found; run npm install");
}

const src = resolveOpenCv();
const destDir = join(root, "apps", "web", "public", "opencv");
const dest = join(destDir, "opencv.js");

mkdirSync(destDir, { recursive: true });
const srcStat = statSync(src);
if (existsSync(dest) && statSync(dest).size === srcStat.size) {
  console.log(`copy-opencv: already present (${dest}, ${srcStat.size} bytes)`);
  process.exit(0);
}
copyFileSync(src, dest);
console.log(`copy-opencv: wrote ${dest} (${srcStat.size} bytes)`);
