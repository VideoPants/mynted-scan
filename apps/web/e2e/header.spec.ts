import { test, expect } from "@playwright/test";

test("iPhone-width header stays ≤ 64px without overlapping boxes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const header = page.getByTestId("site-header");
  await expect(header).toBeVisible();
  const box = await header.boundingBox();
  expect(box?.height ?? 999).toBeLessThanOrEqual(64);

  const overlaps = await page.evaluate(() => {
    const headerEl = document.querySelector('[data-testid="site-header"]');
    if (!headerEl) return true;
    const nodes = Array.from(headerEl.querySelectorAll("a, span, button, img"));
    const rects = nodes
      .map((n) => (n as HTMLElement).getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap =
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        if (overlap) {
          // nested elements (img inside link) are fine
          const ai = nodes[i]!;
          const bj = nodes[j]!;
          if (ai.contains(bj) || bj.contains(ai)) continue;
          return true;
        }
      }
    }
    return false;
  });
  expect(overlaps).toBe(false);
});
