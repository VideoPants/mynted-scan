import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "../../../packages/centering-core/test/fixtures");
const c60 = join(fixturesRoot, "generated/c60.png");

test("manual adjust updates ratio display", async ({ page }) => {
  await page.goto("/en/dev/label");
  const input = page.locator('input[type="number"]').first();
  await input.fill("4.5");
  await expect(page.getByText(/LR /)).toContainText("60.0/40.0");
});

test("adjust lines and results overlay show non-blank card image", async ({ page }) => {
  if (!existsSync(c60)) {
    execFileSync("node", [join(fixturesRoot, "gen-synthetic.mjs")], { stdio: "pipe" });
  }
  expect(existsSync(c60)).toBe(true);

  await page.goto("/en/scan?mode=upload");
  await page.locator('input[type="file"]').setInputFiles(c60);
  await page.getByRole("button", { name: /skip back|تخطّي/i }).click({ timeout: 120_000 });
  await page.waitForURL(/\/results/);

  const resultsImg = page.getByTestId("results-rectified").locator("img");
  await expect(resultsImg).toBeVisible({ timeout: 30_000 });
  const resultsBox = await resultsImg.boundingBox();
  expect(resultsBox?.width ?? 0).toBeGreaterThan(200);

  const resultsVariance = await resultsImg.evaluate(async (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      sum += y;
      sumSq += y * y;
    }
    return sumSq / n - (sum / n) ** 2;
  });
  expect(resultsVariance).toBeGreaterThan(50);

  await page.getByRole("button", { name: /Adjust lines|ضبط الخطوط/i }).click();
  const manualImg = page.getByTestId("manual-rectified");
  await expect(manualImg).toBeVisible();
  const manualBox = await manualImg.boundingBox();
  expect(manualBox?.width ?? 0).toBeGreaterThan(200);

  const manualVariance = await manualImg.evaluate(async (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      sum += y;
      sumSq += y * y;
    }
    return sumSq / n - (sum / n) ** 2;
  });
  expect(manualVariance).toBeGreaterThan(50);
});
