#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
}

if (!existsSync(resolve(root, ".env"))) {
  copyFileSync(resolve(root, ".env.example"), resolve(root, ".env"));
  console.log("Created .env from .env.example");
}

run("npm install");
run("node scripts/db-up.mjs");
run("npm run db:migrate -w @mynted/web");
run("npm run db:seed -w @mynted/web");

mkdirSync(resolve(root, "data/raw"), { recursive: true });
mkdirSync(resolve(root, "data/generated"), { recursive: true });
mkdirSync(resolve(root, "data/real"), { recursive: true });
mkdirSync(resolve(root, "data/labels"), { recursive: true });

try {
  run("cd services/measure-py && uv sync");
} catch {
  console.warn("uv sync failed; Python service can be set up later with `uv sync`.");
}

console.log("\nSetup complete. Run `npm run dev` to start MyntedScan.");