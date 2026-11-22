#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const dockerUrl =
  "postgresql://mynted:mynted@localhost:5433/centering?schema=public";

function writeEnvUrl(url) {
  let content = "";
  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf8");
    if (content.includes("DATABASE_URL=")) {
      content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${url}"`);
      if (content.includes("DIRECT_URL=")) {
        content = content.replace(/DIRECT_URL=.*/g, `DIRECT_URL="${url}"`);
      } else {
        content += `\nDIRECT_URL="${url}"\n`;
      }
    } else {
      content += `\nDATABASE_URL="${url}"\nDIRECT_URL="${url}"\n`;
    }
  } else {
    const example = resolve(root, ".env.example");
    content = existsSync(example)
      ? readFileSync(example, "utf8")
          .replace(/DATABASE_URL=.*/g, `DATABASE_URL="${url}"`)
          .replace(/DIRECT_URL=.*/g, `DIRECT_URL="${url}"`)
      : `DATABASE_URL="${url}"\nDIRECT_URL="${url}"\n`;
  }
  if (!content.includes("AUTH_SECRET=") || content.includes('AUTH_SECRET="replace-me"')) {
    const secret = execSync("openssl rand -base64 32").toString().trim();
    if (content.includes("AUTH_SECRET=")) {
      content = content.replace(/AUTH_SECRET=.*/g, `AUTH_SECRET="${secret}"`);
    } else {
      content += `\nAUTH_SECRET="${secret}"\n`;
    }
  }
  writeFileSync(envPath, content);
  console.log(`Wrote DATABASE_URL to .env`);
}

function tryDocker() {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    return false;
  }
  const up = spawnSync(
    "docker",
    ["compose", "up", "-d", "--wait"],
    { cwd: root, encoding: "utf8" },
  );
  if (up.status !== 0) {
    console.warn(up.stderr || up.stdout);
    return false;
  }
  writeEnvUrl(dockerUrl);
  console.log("Postgres ready via Docker Compose on :5433");
  return true;
}

function tryLocalPgdata() {
  try {
    const pgdata = resolve(root, ".pgdata");
    const pgCtl =
      process.env.PG_CTL ||
      execSync("bash -lc 'command -v pg_ctl || true'", { encoding: "utf8" }).trim() ||
      `${process.env.HOME}/.local/share/mise/installs/postgres/18.7/bin/pg_ctl`;
    if (!existsSync(pgdata)) {
      const initdb =
        process.env.INITDB ||
        `${process.env.HOME}/.local/share/mise/installs/postgres/18.7/bin/initdb`;
      execSync(`"${initdb}" -D "${pgdata}" --auth=trust --username=mynted`, {
        stdio: "inherit",
      });
    }
    const status = spawnSync(pgCtl, ["-D", pgdata, "status"], { encoding: "utf8" });
    if (status.status !== 0) {
      execSync(
        `"${pgCtl}" -D "${pgdata}" -l "${pgdata}/logfile" -o "-p 5433 -h 127.0.0.1 -k ${pgdata}" start`,
        { stdio: "inherit", shell: true },
      );
    }
    try {
      execSync(
        `"${process.env.HOME}/.local/share/mise/installs/postgres/18.7/bin/createdb" -h 127.0.0.1 -p 5433 -U mynted centering`,
        { stdio: "ignore", shell: true },
      );
    } catch {
      /* exists */
    }
    const url = "postgresql://mynted@127.0.0.1:5433/centering?schema=public";
    writeEnvUrl(url);
    console.log("Postgres ready via local .pgdata on :5433");
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

function trySystemPostgres() {
  try {
    execSync("which psql", { stdio: "ignore" });
    execSync("createdb centering 2>/dev/null || true");
    const url = "postgresql://localhost:5432/centering?schema=public";
    writeEnvUrl(url);
    console.log("Using system PostgreSQL database `centering`");
    return true;
  } catch {
    return false;
  }
}

if (tryDocker()) process.exit(0);
console.warn("Docker unavailable; trying local .pgdata…");
if (tryLocalPgdata()) process.exit(0);
console.warn("Local .pgdata unavailable; trying system Postgres…");
if (trySystemPostgres()) process.exit(0);

console.error(
  "Could not start a database. Start Docker (`sudo systemctl enable --now docker`) or install PostgreSQL.",
);
process.exit(1);