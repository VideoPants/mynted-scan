import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// Playwright loads specs as CJS unless package type=module; avoid import.meta.
const fixturesRoot = join(process.cwd(), "../../packages/centering-core/test/fixtures");
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

test("adjust Done updates overlay lines, borders, and save payload", async ({ page }) => {
  if (!existsSync(c60)) {
    execFileSync("node", [join(fixturesRoot, "gen-synthetic.mjs")], { stdio: "pipe" });
  }
  expect(existsSync(c60)).toBe(true);

  await page.goto("/en/scan?mode=upload");
  await page.locator('input[type="file"]').setInputFiles(c60);
  await page.getByRole("button", { name: /skip back|تخطّي/i }).click({ timeout: 120_000 });
  await page.waitForURL(/\/results/);

  const bordersBefore = await page.locator(".mono-num").filter({ hasText: /L / }).first().innerText();
  const leftBefore = await page.getByTestId("overlay-inner-L").evaluate((el) => el.style.left);

  await page.getByRole("button", { name: /Adjust lines|ضبط الخطوط/i }).click();
  const handleL = page.getByRole("button", { name: "inner L" });
  await expect(handleL).toBeVisible();
  const box = await handleL.boundingBox();
  expect(box).toBeTruthy();
  const parent = page.locator(".aspect-\\[63\\/88\\]").last();
  const parentBox = await parent.boundingBox();
  expect(parentBox).toBeTruthy();
  // Drag L handle toward the right (~+15% of width).
  await handleL.dragTo(parent, {
    targetPosition: {
      x: (parentBox!.width * 0.25),
      y: parentBox!.height / 2,
    },
  });

  await page.getByRole("button", { name: /Done|تم/i }).click();
  await expect(page.getByTestId("overlay-inner-L")).toBeVisible();

  const leftAfter = await page.getByTestId("overlay-inner-L").evaluate((el) => el.style.left);
  const bordersAfter = await page.locator(".mono-num").filter({ hasText: /L / }).first().innerText();
  expect(leftAfter).not.toBe(leftBefore);
  expect(bordersAfter).not.toBe(bordersBefore);
  await expect(page.getByText(/Manually adjusted|معدّل يدويًا/i)).toBeVisible();

  type PostedLines = { inner?: { L?: { x1: number } } };
  let postedLines: PostedLines | undefined;
  await page.route("**/api/scans", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        report?: { faces?: Array<{ lines?: PostedLines }> };
      };
      postedLines = body.report?.faces?.[0]?.lines;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    });
  });
  await page.getByRole("button", { name: /Save|حفظ/i }).click();
  expect(postedLines?.inner?.L?.x1).toBeGreaterThan(0);
  const expectedLeftPct = parseFloat(leftAfter);
  const postedPct = ((postedLines!.inner!.L!.x1) / 1260) * 100;
  expect(Math.abs(postedPct - expectedLeftPct)).toBeLessThan(1);

  await page.reload();
  await page.waitForURL(/\/results/);
  const leftReload = await page.getByTestId("overlay-inner-L").evaluate((el) => el.style.left);
  expect(leftReload).toBe(leftAfter);
});
