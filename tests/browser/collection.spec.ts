import { test, expect } from '@playwright/test';

test('delayed collection initialization preserves edits to URL search', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_astro/collection.*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/writing/?q=原来的词', { waitUntil: 'domcontentloaded' });
    const input = page.getByRole('searchbox');
    await expect(input).toHaveValue('原来的词');
    await input.fill('共同检索词');
    release();
    await expect(page).toHaveURL(/q=%E5%85%B1%E5%90%8C/);
    await expect(input).toHaveValue('共同检索词');
    await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(2);
  } finally {
    release();
  }
});

test('clearing URL search before initialization stays cleared', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_astro/collection.*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/writing/?q=原来的词', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('searchbox')).toHaveValue('原来的词');
    await page.getByRole('searchbox').fill('');
    release();
    await expect(page).toHaveURL('/writing/');
    await expect(page.getByRole('searchbox')).toHaveValue('');
  } finally {
    release();
  }
});

for (const route of ['/audio/', '/archive/?tag=声音']) {
  test(`search only loads audio result fragments on ${route}`, async ({
    page,
  }) => {
    const fragments = new Set<string>();
    page.on('request', (request) => {
      if (request.url().endsWith('.pf_fragment')) fragments.add(request.url());
    });
    await page.goto(route);
    await page.getByRole('searchbox').fill('共同检索词');
    await expect(page).toHaveURL(/q=%E5%85%B1%E5%90%8C/);
    await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(2);
    await expect(page.getByRole('status')).toHaveText(
      route.startsWith('/audio/') ? '2 条声音' : '2 条记录',
    );
    await expect(page.locator('.search-notice')).toBeHidden();
    for (const row of await page
      .locator('#rows [data-entry-key]:visible')
      .all())
      await expect(row).toHaveAttribute('data-entry-key', /^audio:/);
    expect(fragments.size).toBe(2);
  });
}

test('filtering keeps the reading layout and keyboard focus steady', async ({
  page,
}) => {
  await page.goto('/writing/');
  const button = page.getByRole('button', { name: '随笔', exact: true });
  await button.focus();
  const before = await page.locator('.index-controls').boundingBox();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toBeFocused();
  await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(1);
  await expect(page.locator('[data-feature]')).toBeVisible();
  expect((await page.locator('.index-controls').boundingBox())!.y).toBe(
    before!.y,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('unavailable full-text search falls back to titles and summaries', async ({
  page,
}) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.abort());
  await page.goto('/writing/?q=测试文章');
  await expect(page.locator('.search-notice')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('2 篇文字');
  await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(2);
  await expect(page.getByRole('searchbox')).toHaveValue('测试文章');
});
