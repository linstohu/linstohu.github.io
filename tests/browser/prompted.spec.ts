import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from '../helpers/viewport.ts';

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
    '我',
    'ChatGPT',
    '我',
    'ChatGPT',
  ]);
  await expect(page.locator('.dialogue-caption')).toHaveCount(0);
  await expect(page.locator('.dialogue-avatar')).toHaveCount(8);
  await expect(
    page.locator('[data-speaker="user"] > .dialogue-avatar').first(),
  ).toHaveText('R');
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

for (const width of [1280, 320]) {
  test(
    'author, assistant and date align within each byline row at ' +
      width +
      'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/writing/a-question/');
      const byline = page.locator('.byline');
      const bounds = (await byline.boundingBox())!;
      const parts = await byline
        .locator(':scope > span:first-child, .article-source, time')
        .evaluateAll((items) =>
          items.map((item) => {
            // A zero-height inline box sits on the text baseline even when Chinese and Latin glyphs use different fonts.
            const marker = document.createElement('i');
            marker.style.cssText =
              'display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0;border:0';
            item.append(marker);
            const baseline = marker.getBoundingClientRect().top;
            marker.remove();
            const { left, right, top, bottom } = item.getBoundingClientRect();
            return { left, right, top, bottom, baseline };
          }),
        );
      expect(parts).toHaveLength(3);
      for (const part of parts) {
        expect(part.left).toBeGreaterThanOrEqual(bounds.x - 1);
        expect(part.right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      }
      if (width === 1280) {
        for (const part of parts)
          expect(
            Math.abs(part.baseline - parts[0].baseline),
          ).toBeLessThanOrEqual(1);
      } else {
        expect(parts[2].baseline).toBeGreaterThan(parts[0].baseline + 1);
        for (const [i, current] of parts.slice(1).entries()) {
          const previous = parts[i];
          if (current.left >= previous.right - 1)
            expect(
              Math.abs(current.baseline - previous.baseline),
            ).toBeLessThanOrEqual(1);
          else expect(current.top).toBeGreaterThanOrEqual(previous.bottom - 1);
        }
      }
    },
  );
}

test('dialogue separates speakers and keeps rich answers readable across themes and widths', async ({
  page,
}) => {
  await page.goto('/writing/a-question/');
  await page.getByRole('button', { name: '通读回答' }).first().click();
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
      await expect(question).toHaveCSS('border-inline-end-width', '2px');
      await expect(question).toHaveCSS('border-top-width', '0px');
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
      await expectNoHorizontalOverflow(page);
    }
  }
});

test('readers can skim an answer, open a subsection by keyboard and follow its heading link', async ({
  page,
}) => {
  await page.goto('/writing/a-question/');
  const answer = page.locator('[data-speaker="assistant"]').first();
  const sections = answer.locator('details.reply-section');
  await expect(sections).toHaveCount(3);
  await expect(answer.locator('details[open]')).toHaveCount(0);
  await expect(
    answer.getByText('先把发生的事写下来，再看当时自己能决定什么。'),
  ).toBeVisible();
  await expect(answer.getByText(/^比如，同事给你的数据/)).toBeVisible();
  await expect(
    answer.getByText('对话还可以继续，不必急着写出结论。'),
  ).toBeVisible();
  await expect(answer.locator('pre')).toBeHidden();
  const second = sections.nth(1);
  await second.locator(':scope > summary').press('Enter');
  await expect(second).toHaveAttribute('open', '');
  await expect(sections.first()).not.toHaveAttribute('open', '');
  const child = sections.nth(2);
  const childHeading = second.getByRole('heading', { name: '先从哪里观察？' });
  const fragment =
    '#' + encodeURIComponent((await childHeading.getAttribute('id'))!);
  await expect(childHeading).toBeVisible();
  await expect(
    second.getByText('留意下一次想要责怪别人的时刻。'),
  ).toBeVisible();
  await child.locator('summary').press('Space');
  await expect(
    child.getByText('先把听到的原话和自己的推测分开。'),
  ).toBeVisible();

  await answer.getByRole('button', { name: '通读回答' }).click();
  await expect(answer.locator('details[open]')).toHaveCount(3);
  await expect(answer.locator('summary:visible')).toHaveCount(0);
  await expect(answer.locator('pre')).toBeVisible();
  await answer.getByRole('button', { name: '收起细节' }).click();
  await expect(answer.locator('details[open]')).toHaveCount(0);
  await expect(answer.getByText(/^比如，同事给你的数据/)).toBeVisible();
  await page.goto('/writing/a-question/' + fragment);
  await expect(second).toHaveAttribute('open', '');
  await expect(child).toHaveAttribute('open', '');
  await expect(childHeading).toBeInViewport();
  await expect(sections.first()).not.toHaveAttribute('open', '');

  const list = page
    .getByRole('group', { name: '第 2 轮对话' })
    .locator('details.reply-section');
  await expect(list.locator('summary')).toHaveText('清单（8 项）');
  await expect(list.locator('ol')).toBeHidden();
  await list.locator('summary').press('Enter');
  await expect(list.locator('li').last()).toBeVisible();
  await expect(list.locator('li')).toHaveCount(8);
});

test('the open reply outline advances with reading and stays still with reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 650 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/writing/a-question/');
  const answer = page.locator('[data-speaker="assistant"]').first();
  await expect(answer.locator('.reply-trace')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await answer.getByRole('button', { name: '通读回答' }).click();
  const path = answer.locator('.reply-trace path');
  await expect(path).toHaveAttribute('d', /^M /);
  async function scrollToProgress(progress: number) {
    await answer.evaluate((element, position) => {
      const rect = element.getBoundingClientRect();
      window.scrollTo(
        0,
        scrollY + rect.top + rect.height * position - innerHeight * 0.72,
      );
    }, progress);
  }
  const offset = () =>
    path.evaluate((node) =>
      parseFloat(getComputedStyle(node).strokeDashoffset),
    );
  await scrollToProgress(0.15);
  await expect.poll(offset).toBeGreaterThan(0.75);
  await scrollToProgress(0.65);
  await expect.poll(offset).toBeLessThan(0.45);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(answer.locator('.reply-trace')).toBeHidden();
  expect(
    await answer.evaluate(
      (node) => getComputedStyle(node, '::before').borderLeftWidth,
    ),
  ).toBe('1px');
});

test('the question index follows the reader and supports keyboard jumps and direct links', async ({
  page,
}) => {
  await page.goto('/writing/a-question/#dialogue:2');
  const nav = page.getByRole('navigation', { name: '对话目录' });
  const summary = nav.locator('summary');
  const links = nav.locator('ol a');
  const third = page.getByRole('group', { name: '第 3 轮对话' });
  const compact = await page.evaluate(
    () => matchMedia('(width < 64rem)').matches,
  );
  await expect(links.nth(1)).toHaveAttribute('aria-current', 'location');
  if (compact) {
    await summary.click();
    await links.nth(2).click();
    await expect(page).toHaveURL(/#dialogue:3$/);
    await expect(links.nth(2)).toHaveAttribute('aria-current', 'location');
    await expect(links.nth(2)).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/#dialogue:2$/);
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'location');
    await summary.click();
    await links.nth(1).click();
    await expect(links.nth(1)).toBeHidden();
    await expect(page).toHaveURL(/#dialogue:2$/);
    await summary.press('Enter');
    await expect(links.nth(2)).toBeVisible();
  }
  await page
    .getByRole('group', { name: '第 2 轮对话' })
    .locator('[data-speaker="assistant"] p')
    .first()
    .click();
  await expect(page).toHaveURL(/#dialogue:2$/);
  if (compact) {
    await expect(links.first()).toBeHidden();
    await summary.press('Enter');
    await links.last().press('Tab');
    await expect(links.first()).toBeHidden();
    await expect(nav.locator(':focus')).toHaveCount(0);
    await summary.press('Enter');
    await links.nth(2).press('Escape');
    await expect(summary).toBeFocused();
    await expect(links.nth(2)).toBeHidden();
    await summary.press('Enter');
  } else await expect(links.nth(2)).toBeVisible();
  await links.nth(2).press('Enter');
  await expect(page).toHaveURL(/#dialogue:3$/);
  await expect(third).toBeFocused();
  await expect(third).toBeInViewport();
  const focusedQuestion = third.locator('[data-speaker="user"]');
  await expect(focusedQuestion).toHaveCSS('outline-style', 'none');
  await expect(focusedQuestion.locator('.dialogue-avatar')).toHaveCSS(
    'outline-style',
    'solid',
  );
  await expect(links.nth(2)).toHaveAttribute('aria-current', 'location');
  if (compact) {
    await expect(links.nth(2)).toBeHidden();
    const bar = (await summary.boundingBox())!;
    expect((await third.boundingBox())!.y).toBeGreaterThanOrEqual(
      bar.y + bar.height - 1,
    );
  }
  await page
    .getByRole('group', { name: '第 1 轮对话' })
    .evaluate((node) => node.scrollIntoView());
  await expect(links.first()).toHaveAttribute('aria-current', 'location');
  await expect(page).toHaveURL(/#dialogue:3$/);
  await page.goBack();
  await expect(page).toHaveURL(/#dialogue:2$/);
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto('/writing/a-question/#dialogue:4');
  await expect(links.last()).toHaveAttribute('aria-current', 'location');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('readers can return to the writing list and reopen a conversation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/writing/a-question/');
    await expect(page.locator('[data-speaker="user"]').first()).toContainText(
      '怎样才能改变这种习惯？',
    );
    await expect(page.locator('.article-body h2')).toHaveCount(2);
    await expect(page.locator('.dialogue-turn')).toHaveCount(8);
    const firstReply = page.locator('[data-speaker="assistant"]').first();
    await expect(firstReply.locator('.reply-toggle')).toBeHidden();
    await expect(firstReply.getByText(/^比如，同事给你的数据/)).toBeVisible();
    await expect(firstReply.locator('table')).toBeHidden();
    await firstReply
      .locator('details.reply-section summary')
      .first()
      .press('Enter');
    await expect(firstReply.locator('table')).toBeVisible();
    const index = page.getByRole('navigation', { name: '对话目录' });
    await index.locator('summary').press('Enter');
    await index
      .getByRole('link', { name: '当下很生气，怎么让自己先停一下？' })
      .click();
    await expect(page).toHaveURL(/#dialogue:3$/);
    await expect(
      page.getByRole('group', { name: '第 3 轮对话' }),
    ).toBeInViewport();
    await expect(page.locator('.article-body > p').last()).toHaveText(
      '这是对话后的笔记。',
    );
    await expect(
      firstReply.getByRole('heading', { name: '还想继续追问' }),
    ).toBeVisible();
    await expect(
      page
        .locator('.article-path')
        .getByRole('link', { name: 'prompted', exact: true }),
    ).toHaveAttribute('href', '/writing/?tag=prompted');
    await page.getByRole('link', { name: '← 返回 prompted' }).click();
    await expect(page).toHaveURL('/writing/?tag=prompted');
    await expect(
      page.getByRole('heading', { level: 1, name: '文字' }),
    ).toBeVisible();
    await page
      .locator('#rows')
      .getByRole('link', { name: /与 AI 的对话/ })
      .click();
    await expect(page).toHaveURL('/writing/a-question/');
    await page.getByRole('link', { name: '← 返回 prompted' }).click();
    await page
      .locator('#rows')
      .getByRole('link', { name: /随手记下一句话/ })
      .click();
    await expect(page).toHaveURL('/writing/open-note/');
    await expect(page.locator('.article-body')).toHaveText(
      '今天只记下一句话。',
    );
    await expect(page.locator('.article-source')).toHaveCount(0);
    await expect(page.locator('.article-body h2')).toHaveCount(0);
    await expect(page.locator('.dialogue-turn')).toHaveCount(0);
    await expect(page.locator('.dialogue-orbits')).toBeHidden();
    await expect(
      page.getByRole('navigation', { name: '对话目录' }),
    ).toHaveCount(0);
  });
});
