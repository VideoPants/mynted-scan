import { test, expect } from "@playwright/test";

const paths = [
  "/en/scan?mode=upload",
  "/en/sign-in",
  "/en/history",
  "/ar/scan",
];

for (const path of paths) {
  test(`locale switcher keeps path on ${path}`, async ({ page }) => {
    await page.goto(path);
    const before = new URL(page.url());
    const switcher = page.getByTestId("locale-switcher");
    await expect(switcher).toBeVisible();
    const target = (await switcher.innerText()).trim().toLowerCase();
    await switcher.click();
    await page.waitForURL((url) => url.pathname.startsWith(`/${target}`));
    const after = new URL(page.url());
    const restBefore = before.pathname.replace(/^\/(en|ar)/, "") || "/";
    const restAfter = after.pathname.replace(/^\/(en|ar)/, "") || "/";
    expect(restAfter).toBe(restBefore);
    expect(after.search).toBe(before.search);
    expect(after.pathname.startsWith(`/${target}`)).toBe(true);
  });
}

test("locale switcher on results keeps /results", async ({ page }) => {
  // Results without a draft still renders the empty state under /results.
  await page.goto("/en/results");
  await page.getByTestId("locale-switcher").click();
  await page.waitForURL(/\/ar\/results/);
  expect(new URL(page.url()).pathname).toBe("/ar/results");
});
