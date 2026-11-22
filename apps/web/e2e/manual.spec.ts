import { test, expect } from "@playwright/test";

test("manual adjust updates ratio display", async ({ page }) => {
  await page.goto("/en/dev/label");
  const input = page.locator('input[type="number"]').first();
  await input.fill("4.5");
  await expect(page.getByText(/LR /)).toContainText("60.0/40.0");
});