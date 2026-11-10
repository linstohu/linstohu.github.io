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

test('Markdown links remain recognizable and keyboard operable in both themes', async ({
  page,
  browserName,
}) => {
  for (const theme of ['light', 'dark']) {
    for (const [url, label] of [
      ['/writing/first/', '我的个人主页'],
      ['/audio/first/', '声音中的链接'],
      ['/about/', '关于页中的链接'],
    ]) {
      await page.goto(url);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.mouse.move(0, 0);
      const link = page.getByRole('link', { name: label, exact: true });
      const appearance = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        function luminance(color: string) {
          const rgb = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
          const linear = rgb.map((value) => {
            value /= 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        }
        const foreground = luminance(style.color);
        const background = luminance(
          getComputedStyle(document.body).backgroundColor,
        );
        return {
          underline: style.textDecorationLine.includes('underline'),
          contrast:
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05),
        };
      });
      expect(
        appearance.underline,
        `${url} ${theme}: link is visible before interaction`,
      ).toBe(true);
      expect(
        appearance.contrast,
        `${url} ${theme}: link text remains readable`,
      ).toBeGreaterThanOrEqual(4.5);
      if (url === '/writing/first/') {
        await expect(link).toHaveAttribute(
          'href',
          'https://music.163.com/#/user/home?id=1995560350',
        );
        await expect(page.locator('.article-path a')).toHaveCSS(
          'text-decoration-line',
          'none',
        );
        await link.focus();
        // Safari uses Option-Tab to include links in its native focus cycle.
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
        const next = page.getByRole('link', {
          name: '另一篇文字',
          exact: true,
        });
        await expect(next).toBeFocused();
        expect(
          await next.evaluate((element) => element.matches(':focus-visible')),
        ).toBe(true);
        await expect(next).toHaveCSS('outline-style', 'solid');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL('/writing/second/');
      }
    }
  }
});

test('Markdown blocks fit narrow screens and disclosures support the keyboard', async ({
  page,
}) => {
  for (const width of [320, 844]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/writing/first/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const body = page.locator('.article-body');
    const column = await body.boundingBox();
    for (const selector of ['blockquote', 'table', 'pre', 'details']) {
      const bounds = await body.locator(selector).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(column!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        column!.x + column!.width + 1,
      );
    }
    const summary = body.locator('summary');
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(body.locator('details')).toHaveAttribute('open', '');
    await expect(
      body.getByRole('link', { name: '正文链接', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Space');
    await expect(body.locator('details')).not.toHaveAttribute('open', '');
  }
});
