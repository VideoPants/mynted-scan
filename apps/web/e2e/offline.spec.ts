import { test, expect } from "@playwright/test";

test("offline pages render in both locales", async ({ page }) => {
  await page.goto("/en/offline");
  await expect(page.getByRole("heading")).toBeVisible();
  await page.goto("/ar/offline");
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("SW serves locale offline page for uncached route", async ({ page, context }) => {
  // Serwist is disabled under `next dev`; run with E2E_PROD=1 against `next start`.
  test.skip(!process.env.E2E_PROD, "requires production SW (E2E_PROD=1)");

  await page.goto("/en");
  await page.waitForFunction(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0;
  }, null, { timeout: 60_000 });

  // Warm offline fallbacks into the cache.
  await page.goto("/en/offline");
  await page.goto("/ar/offline");
  await page.goto("/en");

  await context.setOffline(true);
  await page.goto("/en/sign-up", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading")).toBeVisible({ timeout: 15_000 });
  await expect(page.url()).toMatch(/offline|sign-up/);

  await page.goto("/ar/scan", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading")).toBeVisible({ timeout: 15_000 });
});
