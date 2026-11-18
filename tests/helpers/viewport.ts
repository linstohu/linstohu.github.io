import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page) {
  const { visible, total } = await page.evaluate(() => ({
    visible: document.documentElement.clientWidth,
    total: document.documentElement.scrollWidth,
  }));
  expect(
    total,
    'Document width including overflow (CSS pixels)',
  ).toBeLessThanOrEqual(visible);
}
