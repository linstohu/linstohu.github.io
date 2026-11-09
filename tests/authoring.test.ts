import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createDocument,
  readDocument,
  publishDocument,
} from '../scripts/lib.mjs';

async function fixture(run: (file: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'linsto-authoring-'));
  try {
    await run(path.join(directory, 'index.md'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const data = {
  slug: 'test',
  title: '测试',
  description: '摘要',
  category: '随笔',
  publishedAt: '2026-11-01T09:00:00+08:00',
  draft: true,
};
test('creating a draft never overwrites an existing file', async () =>
  fixture(async (file) => {
    await createDocument(file, data, '原文');
    await assert.rejects(createDocument(file, data, '新文'), {
      code: 'EEXIST',
    });
    assert.match(await readFile(file, 'utf8'), /原文/);
  }));
test('publishing preserves Markdown whitespace and later edits keep the first publication date', async () =>
  fixture(async (file) => {
    await createDocument(file, data, '模板');
    const original = await readFile(file, 'utf8');
    const body = '\n    indented code\n\n正文  \n下一行\n\n';
    await writeFile(
      file,
      original.slice(0, original.lastIndexOf('---') + 4) + body,
    );
    const first = await publishDocument(
      file,
      'writing',
      '2026-11-02T09:00:00+08:00',
    );
    const after = await readDocument(file);
    assert.equal(after.body, body);
    assert.equal(after.data.draft, false);
    assert.equal(await publishDocument(file, 'writing'), first);
    assert.equal((await readDocument(file)).data.publishedAt, first);
    assert.ok((await readDocument(file)).data.updatedAt);
  }));
test('invalid metadata cannot change a file into a published state', async () =>
  fixture(async (file) => {
    await createDocument(file, { ...data, title: ' ' }, '未完成');
    const before = await readFile(file, 'utf8');
    await assert.rejects(publishDocument(file, 'writing'));
    assert.equal(await readFile(file, 'utf8'), before);
  }));
