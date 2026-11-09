import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBuild } from '../scripts/build-validation.mjs';
test('build validation covers relative assets and actual page anchors', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'linsto-links-'));
  try {
    await mkdir(path.join(folder, 'essay'));
    await writeFile(
      path.join(folder, 'essay/index.html'),
      '<h1 id="title">文章</h1><a href="#title">标题</a><img src="./photo.png">',
    );
    await assert.rejects(
      validateBuild(folder, 'https://example.org'),
      /photo.png/,
    );
    await writeFile(path.join(folder, 'essay/photo.png'), 'fixture');
    assert.equal(await validateBuild(folder, 'https://example.org'), 2);
    await writeFile(
      path.join(folder, 'essay/index.html'),
      '<a href="#missing">标题</a>',
    );
    await assert.rejects(validateBuild(folder, 'https://example.org'), /锚点/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
