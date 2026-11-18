import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from '../helpers/viewport.ts';

test('navigation and excerpt follow the viewport and preserve keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/writing/');
  const nav = page.getByRole('navigation', { name: '主导航' });
  const menu = page.getByRole('button', { name: /网站导航/ });
  const fragment = page.locator('#fragment-copy');
  await expect(nav).toBeVisible();
  await expect(fragment).toBeVisible();
  await expect(menu).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await expect(fragment).toBeHidden();
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('link', { name: '文字', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page.getByRole('heading', { name: '文字', exact: true }).click();
  await expect(nav).toBeHidden();
  const toggle = page.getByRole('button', { name: '读一段正文' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(fragment).toBeVisible();
  await page.setViewportSize({ width: 844, height: 1000 });
  await expect(nav).toBeVisible();
  await expect(fragment).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await expect(fragment).toBeHidden();
});

test('image viewer supports closing, focus return and repeated opening', async ({
  page,
}) => {
  await page.goto('/writing/first/');
  const opener = page.getByRole('button', { name: '放大查看：文章配图' });
  const dialog = page.getByRole('dialog', { name: '图片大图' });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveAttribute('alt', '文章配图');
  await expect(dialog.locator('.image-caption')).toHaveText('测试配图说明');
  const close = dialog.getByRole('button', { name: '关闭 ×' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('navigation and excerpt remain readable', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/writing/');
    await expect(
      page.getByRole('navigation', { name: '主导航' }),
    ).toBeVisible();
    await expect(page.locator('#fragment-copy')).toBeVisible();
    await expect(page.locator('.mobile-menu')).toBeHidden();
    await expect(page.locator('.fragment-toggle')).toBeHidden();
  });
});

test('mobile navigation and the excerpt stay usable if only the disclosure bundle fails', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let blocked = false;
  await page.route('**/_astro/Disclosure.*.js', async (route) => {
    blocked = true;
    await route.abort();
  });
  await page.goto('/writing/');
  expect(blocked).toBe(true);
  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav).toBeVisible();
  await expect(page.locator('.mobile-menu')).toBeHidden();
  await expect(page.locator('#fragment-copy')).toBeVisible();
  await nav.getByRole('link', { name: '声音' }).click();
  await expect(page).toHaveURL(/\/audio\/$/);
});

test('linked Markdown images and about-page figures fit the mobile reading column', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const [url, alt] of [
    ['/writing/first/', '链接里的宽图'],
    ['/about/', '关于页里的宽图'],
  ]) {
    await page.goto(url);
    const image = page.getByRole('img', { name: alt });
    await expect(image).toBeVisible();
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const edges = await image.evaluate((el) => {
      const image = el.getBoundingClientRect();
      const column = el.closest('.markdown-body')!.getBoundingClientRect();
      return {
        left: image.left - column.left,
        right: column.right - image.right,
      };
    });
    expect(edges.left).toBeGreaterThanOrEqual(-1);
    expect(edges.right).toBeGreaterThanOrEqual(-1);
    await expectNoHorizontalOverflow(page);
  }
});
