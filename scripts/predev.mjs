#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const result = spawnSync("node", ["scripts/db-up.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (result.status !== 0) {
  console.warn("Database pre-check failed; continuing anyway.");
}