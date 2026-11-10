import { test, expect } from '@playwright/test';

test('phone homepage keeps artwork full-width and recent entries stacked', async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const artwork = await page.locator('.mountains').boundingBox();
    expect(artwork!.width).toBeCloseTo(width, 0);
    expect(artwork!.height).toBeLessThan(width);
    const frame = await page.locator('.composition').boundingBox();
    for (const tile of await page.locator('.composition .tile').all()) {
      const box = await tile.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(frame!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        frame!.x + frame!.width + 1,
      );
    }
    const recent = page.locator('.recent-grid > a');
    await expect(recent).toHaveCount(3);
    const column = await page.locator('.recent-grid').boundingBox();
    let bottom = 0;
    for (const entry of await recent.all()) {
      const box = await entry.boundingBox();
      expect(box!.width).toBeCloseTo(column!.width, 0);
      expect(box!.y).toBeGreaterThanOrEqual(bottom);
      bottom = box!.y + box!.height;
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('phone writing page uses mobile navigation and a single featured column', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/writing/');
  const menu = page.locator('.mobile-menu');
  await expect(menu).toHaveAttribute('aria-label', '展开网站导航');
  await expect(menu).toBeVisible();
  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(5);
  await menu.click();
  await expect(nav).toBeHidden();
  const toggle = page.getByRole('button', { name: '读一段正文' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const copy = await page.locator('.feature-copy').boundingBox();
  const fragment = await page.locator('.feature-fragment').boundingBox();
  expect(fragment!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height - 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
