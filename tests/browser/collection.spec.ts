import { test, expect, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow } from '../helpers/viewport.ts';

function observeFragmentRequests(page: Page) {
  const fragments: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('.pf_fragment')) fragments.push(pathname);
  });
  return fragments;
}

for (const [action, edit, count] of [
  ['editing', '共同检索词', 2],
  ['clearing', '', 3],
] as const) {
  test(
    action + ' a URL query before the collection script initializes',
    async ({ page }) => {
      const gate = Promise.withResolvers<void>();
      let intercepted = false;
      await page.route('**/_astro/collection.*.js', async (route) => {
        intercepted = true;
        await gate.promise;
        await route.continue();
      });
      try {
        await page.goto('/writing/?q=原来的词', { waitUntil: 'commit' });
        await expect
          .poll(() => intercepted, {
            message: 'The collection module must be held while typing',
          })
          .toBe(true);
        const input = page.getByRole('searchbox');
        await expect(input).toHaveValue('原来的词');
        await input.fill(edit);
        gate.resolve();
        await expect(page).toHaveURL(
          (url) =>
            url.pathname === '/writing/' &&
            url.searchParams.get('q') === (edit || null),
        );
        await expect(input).toHaveValue(edit);
        await expect(page.getByRole('status')).toHaveText(count + ' 篇文字');
        await expect(
          page.locator('#rows [data-entry-key]:visible'),
        ).toHaveCount(count);
      } finally {
        gate.resolve();
      }
    },
  );
}

for (const route of ['/audio/', '/archive/?tag=声音']) {
  test(`search identifies audio rows without downloading result fragments on ${route}`, async ({
    page,
  }) => {
    const fragments = observeFragmentRequests(page);
    if (route === '/audio/') {
      await page.goto('/audio/?tag=溪边电台');
      await expect(page).toHaveURL('/audio/?tag=field-notes');
      await expect(page.locator('[data-filter="field-notes"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } else {
      await page.goto(route);
    }
    const input = page.getByRole('searchbox');
    const results = page.locator('#rows [data-entry-key]:visible');
    const unit = route === '/audio/' ? '条声音' : '条记录';
    const status = page.getByRole('status');
    const notice = page.locator('.search-notice');
    await input.fill('共同检索词');
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('q') === '共同检索词',
    );
    await expect(status).toHaveText('2 ' + unit);
    await expect(results).toHaveCount(2);
    for (const slug of ['first', 'second'])
      await expect(
        results.and(page.locator('[href="/audio/' + slug + '/"]')),
      ).toHaveCount(1);
    await expect(notice).toBeHidden();

    await input.fill('蝉鸣');
    await expect(status).toHaveText('1 ' + unit);
    await expect(results).toHaveCount(1);
    await expect(results).toHaveAttribute('href', '/audio/first/');
    await expect(notice).toBeHidden();
    expect(fragments).toEqual([]);
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
  await expectNoHorizontalOverflow(page);
});

test('unavailable full-text search falls back to titles and summaries', async ({
  page,
}) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.abort());
  await page.goto('/writing/?q=测试文章');
  const notice = page.locator('.search-notice');
  const status = page.getByRole('status');
  const results = page.locator('#rows [data-entry-key]:visible');
  const input = page.getByRole('searchbox');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('标题、摘要');
  await expect(input).toHaveValue('测试文章');
  await expect(status).toHaveText('2 篇文字');
  await expect(results).toHaveCount(2);

  await input.fill('从生活里的一个问题出发');
  await expect(status).toHaveText('1 篇文字');
  await expect(results).toHaveAttribute('href', '/writing/a-question/');
  await input.fill('共同检索词');
  await expect(status).toHaveText('0 篇文字');
  await expect(results).toHaveCount(0);
  await expect(page.locator('.empty-list')).toBeVisible();

  await input.fill('');
  await expect(page).toHaveURL('/writing/');
  await expect(status).toHaveText('3 篇文字');
  await expect(notice).toBeHidden();
  await expect(page.locator('.empty-list')).toBeHidden();
});

test('assistant metadata and body searches respect the selected writing category', async ({
  page,
}) => {
  const fragments = observeFragmentRequests(page);
  await page.goto('/writing/?tag=prompted&q=ChatGPT');
  const visible = page.locator('#rows [data-entry-key]:visible');
  await expect(visible).toHaveCount(1);
  await expect(visible).toHaveAttribute('data-entry-key', 'writing:a-question');
  await page.getByRole('searchbox').fill('promptedneedles');
  await expect(page).toHaveURL(/q=promptedneedles/);
  await expect(page.getByRole('status')).toHaveText('1 篇文字');
  await expect(visible).toHaveAttribute('data-entry-key', 'writing:a-question');
  await expect(page.locator('.search-notice')).toBeHidden();
  expect(fragments).toEqual([]);
});
