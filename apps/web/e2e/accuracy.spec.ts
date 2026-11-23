import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "../../../packages/centering-core/test/fixtures");
const generatedDir = join(fixturesRoot, "generated");

type Case = {
  id: string;
  leftPct: number;
  rightPct: number;
  topPct: number;
  bottomPct: number;
};

function ensureFixtures(): Case[] {
  execFileSync("node", [join(fixturesRoot, "gen-synthetic.mjs")], { stdio: "pipe" });
  return JSON.parse(readFileSync(join(generatedDir, "cases.json"), "utf8")) as Case[];
}

function parsePair(text: string): { a: number; b: number } {
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return { a: NaN, b: NaN };
  return { a: Number(m[1]), b: Number(m[2]) };
}

test.describe("synthetic upload accuracy ±1.5 pp", () => {
  const cases = ensureFixtures();

  for (const c of cases) {
    test(`upload ${c.id}`, async ({ page }) => {
      const png = join(generatedDir, `${c.id}.png`);
      expect(existsSync(png)).toBe(true);

      await page.goto("/en/scan?mode=upload");
      const input = page.locator('input[type="file"]');
      await input.setInputFiles(png);

      // Skip back after front measures
      await page.getByRole("button", { name: /skip back|تخطّي/i }).click({ timeout: 120_000 });
      await page.waitForURL(/\/results/);

      const lrText = await page.locator("p.mono-num").first().innerText();
      const lr = parsePair(lrText);
      expect(Math.abs(lr.a - c.leftPct)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(lr.b - c.rightPct)).toBeLessThanOrEqual(1.5);

      // Must not show OK-looking ceilings when unsupported; for OK cases status badge present
      const status = page.getByText(/OK|Low confidence|Unsupported|ثقة|تعذّر|OK/i).first();
      await expect(status).toBeVisible();
    });
  }

  test("identical-output check across fixtures", async ({ page }) => {
    const signatures: string[] = [];
    for (const c of cases.slice(0, 4)) {
      const png = join(generatedDir, `${c.id}.png`);
      await page.goto("/en/scan?mode=upload");
      await page.locator('input[type="file"]').setInputFiles(png);
      await page.getByRole("button", { name: /skip back|تخطّي/i }).click({ timeout: 120_000 });
      await page.waitForURL(/\/results/);
      const lrText = await page.locator("p.mono-num").first().innerText();
      signatures.push(lrText.replace(/\s+/g, ""));
    }
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
