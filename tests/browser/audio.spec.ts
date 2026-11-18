import { expect, test } from '@playwright/test';

const recording = '/audio/field-recording/';

test('recording controls play, pause and seek the actual audio', async ({
  page,
}) => {
  await page.goto(recording);
  const player = page.locator('[data-audio-player]');
  const audio = player.locator('audio');
  const play = player.getByRole('button', { name: '播放', exact: true });
  const pause = player.getByRole('button', { name: '暂停', exact: true });
  const seek = player.getByRole('slider', { name: '播放进度' });
  const position = () =>
    audio.evaluate((el: HTMLAudioElement) => el.currentTime);

  await expect(play).toBeVisible();
  await expect(audio).toBeHidden();
  await play.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(position).toBeGreaterThan(0);
  await pause.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(true);

  await page.getByRole('button', { name: /第二章/ }).click();
  await expect.poll(position).toBeCloseTo(5, 1);
  await expect(seek).toHaveAttribute('aria-valuetext', '0:05，共 0:12');
  await expect(player.locator('output')).toHaveText('0:05 / 0:12');
  await seek.focus();
  await seek.press('ArrowLeft');
  await expect.poll(position).toBeCloseTo(4, 1);
  await expect(seek).toHaveAttribute('aria-valuetext', '0:04，共 0:12');
});

test('an unavailable audio file reveals the native player and a readable error', async ({
  page,
}) => {
  await page.goto('/audio/unavailable/');
  const player = page.locator('[data-audio-player]');
  const audio = player.locator('audio[controls]');
  await player.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.error?.code ?? 0))
    .toBeGreaterThan(0);
  const message = player.locator('[data-audio-status]');
  await expect(message).toBeVisible();
  await expect(message).toContainText('无法');
  await expect(audio).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('a recording opens with native playback controls', async ({ page }) => {
    await page.goto(recording);
    const player = page.locator('[data-audio-player]');
    await expect(player.locator('audio[controls]')).toBeVisible();
    await expect(
      player.getByRole('button', { name: '播放', exact: true }),
    ).toBeHidden();
  });
});
