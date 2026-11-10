import { test, expect } from '@playwright/test';

test('Chinese paragraphs use the reading column without shortened lines', async ({
  page,
}) => {
  for (const width of [320, 375, 402, 430, 844]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/writing/first/');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      const paragraph = page
        .locator('.article-body p')
        .filter({ hasText: '无论是技术还是艺术' });
      const metrics = await paragraph.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const column = element.getBoundingClientRect();
        return {
          fontSize: parseFloat(getComputedStyle(element).fontSize),
          lines: [...range.getClientRects()]
            .filter((line) => line.width > 0)
            .map((line) => ({
              width: line.width,
              gap: column.right - line.right,
            })),
        };
      });
      expect(metrics.lines.length).toBeGreaterThan(1);
      for (const line of metrics.lines.slice(0, -1))
        expect(
          line.gap,
          `${width}px ${theme}: non-final Chinese line should fill the column`,
        ).toBeLessThanOrEqual(metrics.fontSize * 2 + 1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
