#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
spawnSync(process.execPath, [join(root, "scripts", "copy-opencv.mjs")], {
  stdio: "inherit",
});
const dest = join(root, "apps", "web", "public", "opencv", "opencv.js");
if (!existsSync(dest) || statSync(dest).size < 100_000) {
  console.error("check-opencv: missing or tiny opencv.js at", dest);
  process.exit(1);
}
console.log("check-opencv: ok", statSync(dest).size, "bytes");
