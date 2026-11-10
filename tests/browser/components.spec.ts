import { test, expect } from '@playwright/test';

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

test('navigation and excerpt remain readable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 800 },
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/writing/');
    await expect(
      page.getByRole('navigation', { name: '主导航' }),
    ).toBeVisible();
    await expect(page.locator('#fragment-copy')).toBeVisible();
    await expect(page.locator('.mobile-menu')).toBeHidden();
    await expect(page.locator('.fragment-toggle')).toBeHidden();
  } finally {
    await context.close();
  }
});
