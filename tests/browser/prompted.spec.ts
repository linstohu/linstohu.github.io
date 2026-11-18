import { test, expect } from '@playwright/test';

test('prompted filtering, full-text search and return navigation stay connected', async ({
  page,
}) => {
  await page.goto('/writing/');
  const filter = page.getByRole('button', { name: 'prompted', exact: true });
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(filter).toBeFocused();
  await expect(page.locator('[data-category-note="prompted"]')).toBeVisible();
  await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(2);
  await expect(
    page.locator('#rows [data-category="prompted"] small').first(),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('promptedneedles');
  await expect(page.getByRole('status')).toHaveText('1 篇文字');
  await expect(page.locator('.search-notice')).toBeHidden();
  await page
    .locator('#rows')
    .getByRole('link', { name: /与 AI 的对话/ })
    .click();
  await expect(page).toHaveURL('/writing/a-question/');
  await expect(page.locator('[data-speaker="user"]').first()).toBeVisible();
  await expect(page.locator('.dialogue-speaker')).toHaveText([
    '我',
    'ChatGPT',
    '我',
    'ChatGPT',
  ]);
  await expect(page.locator('.dialogue-caption')).toHaveCount(0);
  await expect(page.locator('.dialogue-avatar')).toHaveCount(4);
  await expect(
    page.locator('[data-speaker="user"] > .dialogue-avatar').first(),
  ).toHaveText('L');
  await expect(
    page.locator('[data-speaker="assistant"] > .dialogue-avatar svg').first(),
  ).toBeVisible();
  await expect(page.locator('.article-source')).toContainText('ChatGPT');
  await expect(page.locator('.article-source')).toContainText('已知的模型名称');
  await expect(page.getByRole('link', { name: '原对话 ↗' })).toHaveAttribute(
    'href',
    'https://example.org/conversation',
  );
  await page.getByRole('link', { name: '← 返回 prompted' }).click();
  await expect(page).toHaveURL('/writing/?tag=prompted');
  await expect(page.locator('#rows [data-entry-key]:visible')).toHaveCount(2);
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await expect(page.locator('[data-category-note="prompted"]')).toBeHidden();
});

test('the publication date shares the author’s text baseline', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/writing/a-question/');
  const [author, date] = await page
    .locator('.byline > span:first-child, .byline time')
    .evaluateAll((items) =>
      items.map((item) => {
        const range = document.createRange();
        range.selectNodeContents(item);
        return range.getBoundingClientRect().bottom;
      }),
    );
  expect(date).toBeCloseTo(author, 0);
});

test('dialogue separates speakers and keeps rich answers readable across themes and widths', async ({
  page,
}) => {
  await page.goto('/writing/a-question/');
  for (const width of [320, 375, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (value) => (document.documentElement.dataset.theme = value),
        theme,
      );
      const column = await page.locator('.article-body').boundingBox();
      for (const selector of [
        '.article-source',
        '[data-speaker="user"]',
        '[data-speaker="assistant"]',
        '.dialogue-content',
        '.article-body blockquote',
        '.article-body h2',
        '.article-body pre',
        '.article-body table',
      ]) {
        const bounds = await page.locator(selector).first().boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(column!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
          column!.x + column!.width + 1,
        );
      }
      const title = (await page.locator('.article-head h1').boundingBox())!;
      const orbits = (await page.locator('.dialogue-orbits').boundingBox())!;
      expect(
        orbits.y + orbits.height <= title.y ||
          orbits.x >= title.x + title.width,
      ).toBe(true);
      const question = page.locator('[data-speaker="user"]').first();
      await expect(question).not.toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      );
      const answer = page.locator('[data-speaker="assistant"]').first();
      await expect(answer).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const questionBounds = (await question.boundingBox())!;
      const answerBounds = (await answer.boundingBox())!;
      const [userStyle, assistantStyle] = await Promise.all(
        [question, answer].map((turn) =>
          turn.locator('.dialogue-content').evaluate((node) => {
            const style = getComputedStyle(node);
            function luminance(color: string) {
              const [r, g, b] = color
                .match(/[\d.]+/g)!
                .slice(0, 3)
                .map(Number)
                .map((value) => {
                  value /= 255;
                  return value <= 0.04045
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4;
                });
              return r * 0.2126 + g * 0.7152 + b * 0.0722;
            }
            const text = luminance(style.color);
            let paper = node;
            while (
              paper.parentElement &&
              getComputedStyle(paper).backgroundColor === 'rgba(0, 0, 0, 0)'
            ) {
              paper = paper.parentElement;
            }
            const background = luminance(
              getComputedStyle(paper).backgroundColor,
            );
            return {
              size: parseFloat(style.fontSize),
              family: style.fontFamily,
              color: style.color,
              contrast:
                (Math.max(text, background) + 0.05) /
                (Math.min(text, background) + 0.05),
            };
          }),
        ),
      );
      expect(userStyle.size).toBeGreaterThan(assistantStyle.size);
      expect(userStyle.family).not.toBe(assistantStyle.family);
      expect(userStyle.color).not.toBe(assistantStyle.color);
      for (const { contrast } of [userStyle, assistantStyle]) {
        expect(
          contrast,
          `${width}px ${theme}: message text remains readable`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(questionBounds.x).toBeGreaterThan(answerBounds.x);
      expect(questionBounds.x + questionBounds.width).toBeGreaterThan(
        answerBounds.x + answerBounds.width,
      );
      const shortQuestion = page.locator('[data-speaker="user"]').last();
      expect((await shortQuestion.boundingBox())!.width).toBeLessThan(
        questionBounds.width,
      );
      expect((await question.boundingBox())!.width).toBeGreaterThanOrEqual(
        Math.min(250, column!.width),
      );
      const heading = page.locator('.article-body h2').first();
      const paragraph = page.locator('.article-body > p').first();
      const headingSize = await heading.evaluate((node) =>
        parseFloat(getComputedStyle(node).fontSize),
      );
      const bodySize = await paragraph.evaluate((node) =>
        parseFloat(getComputedStyle(node).fontSize),
      );
      expect(headingSize).toBeGreaterThan(bodySize);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test('conversation content and category navigation work without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/writing/a-question/');
    await expect(page.locator('[data-speaker="user"]').first()).toContainText(
      'promptedneedles',
    );
    await expect(page.locator('.article-body h2')).toHaveCount(2);
    await expect(page.locator('.dialogue-turn')).toHaveCount(4);
    await expect(page.locator('.article-body > p').last()).toHaveText(
      '这是对话后的笔记。',
    );
    await expect(
      page.getByRole('heading', { name: '还想继续追问', exact: true }),
    ).toBeAttached();
    await expect(
      page
        .locator('.article-path')
        .getByRole('link', { name: 'prompted', exact: true }),
    ).toHaveAttribute('href', '/writing/?tag=prompted');
    await page.goto('/writing/open-note/');
    await expect(page.locator('.article-body')).toHaveText(
      '今天只记下一句话。',
    );
    await expect(page.locator('.article-source')).toHaveCount(0);
    await expect(page.locator('.article-body h2')).toHaveCount(0);
    await expect(page.locator('.dialogue-turn')).toHaveCount(0);
    await expect(page.locator('.dialogue-orbits')).toBeHidden();
  } finally {
    await context.close();
  }
});
