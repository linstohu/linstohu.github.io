import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestProject } from './helpers/project.mjs';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  stat,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createDocument,
  createWriting,
  readDocument,
  publishDocument,
  withNewAudio,
} from '../scripts/lib.mjs';

async function fixture(run: (file: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'linsto-authoring-'));
  try {
    await run(path.join(directory, 'writing', '2026-11-01-test', 'index.md'));
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
    const after = await readDocument(first.file);
    assert.equal(after.body, body);
    assert.equal(after.data.draft, false);
    assert.equal(
      (await publishDocument(first.file, 'writing')).publishedAt,
      first.publishedAt,
    );
    assert.equal(
      (await readDocument(first.file)).data.publishedAt,
      first.publishedAt,
    );
    assert.ok((await readDocument(first.file)).data.updatedAt);
  }));
test('invalid metadata cannot change a file into a published state', async () =>
  fixture(async (file) => {
    await createDocument(file, { ...data, title: ' ' }, '未完成');
    const before = await readFile(file, 'utf8');
    await assert.rejects(publishDocument(file, 'writing'));
    assert.equal(await readFile(file, 'utf8'), before);
  }));

test('an empty monthly template stays a draft when publication is rejected', async (t) => {
  const project = await createTestProject();
  t.after(project.dispose);
  project.cli(
    'content',
    'new',
    'now',
    '--period',
    '2025-11',
    '--title',
    '本月',
  );
  const relative = 'now/2025-11.md';
  const file = project.content(relative);
  const draft = await readDocument(file);
  assert.equal(draft.data.draft, true);
  assert.equal(draft.body.trim(), '');
  assert.throws(() => project.cli('content', 'publish', relative), {
    status: 1,
    stderr: /Markdown 正文或 notes/,
  });
  assert.equal(await readFile(file, 'utf8'), draft.raw);
});

test('draft creation uses the Shanghai date and rejects a reused slug across dates', async () =>
  fixture(async (file) => {
    const directory = path.dirname(path.dirname(file));
    const created = await createWriting(
      directory,
      { ...data, publishedAt: '2026-11-01T18:00:00Z' },
      '正文',
    );
    assert.equal(path.basename(path.dirname(created)), '2026-11-02-test');
    await assert.rejects(
      createWriting(
        directory,
        { ...data, publishedAt: '2026-11-03T00:00:00+08:00' },
        '另一篇',
      ),
      /slug 已存在/,
    );
    assert.equal((await readDocument(created)).body.trim(), '正文');
  }));

test('publishing relocates the whole article bundle and explicit date corrections keep its slug', async () =>
  fixture(async (file) => {
    await createDocument(file, data, '正文');
    await writeFile(
      path.join(path.dirname(file), 'photo.webp'),
      'original image bytes',
    );
    const first = await publishDocument(
      file,
      'writing',
      '2026-11-01T18:00:00Z',
    );
    assert.equal(path.basename(path.dirname(first.file)), '2026-11-02-test');
    assert.equal(
      await readFile(path.join(path.dirname(first.file), 'photo.webp'), 'utf8'),
      'original image bytes',
    );
    await assert.rejects(stat(file), { code: 'ENOENT' });
    const second = await publishDocument(
      first.file,
      'writing',
      '2026-11-03T18:00:00Z',
    );
    assert.equal(path.basename(path.dirname(second.file)), '2026-11-04-test');
    assert.equal((await readDocument(second.file)).data.slug, 'test');
    assert.equal(
      await readFile(
        path.join(path.dirname(second.file), 'photo.webp'),
        'utf8',
      ),
      'original image bytes',
    );
  }));

test('an occupied destination prevents publication without touching either bundle', async () =>
  fixture(async (file) => {
    await createDocument(file, data, '原文');
    const target = path.join(
      path.dirname(path.dirname(file)),
      '2026-11-02-test',
      'index.md',
    );
    await createDocument(target, { ...data, title: '占用目录' }, '另一篇');
    const before = await readFile(file, 'utf8');
    const occupied = await readFile(target, 'utf8');
    await assert.rejects(
      publishDocument(file, 'writing', '2026-11-02T00:00:00+08:00'),
      /已存在同名/,
    );
    assert.equal(await readFile(file, 'utf8'), before);
    assert.equal(await readFile(target, 'utf8'), occupied);
    assert.deepEqual(await readdir(path.dirname(file)), ['index.md']);
    await assert.rejects(
      stat(path.join(path.dirname(path.dirname(file)), '.authoring.lock')),
      { code: 'ENOENT' },
    );
  }));

test('concurrent draft creation cannot create two bundles for the same slug', async () =>
  fixture(async (file) => {
    const directory = path.dirname(path.dirname(file));
    const results = await Promise.allSettled([
      createWriting(directory, data, '第一篇'),
      createWriting(
        directory,
        { ...data, publishedAt: '2026-11-02T00:00:00+08:00' },
        '第二篇',
      ),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await readdir(directory)).length, 1);
  }));

test('publication preserves YAML comments on fields, nested metadata and the original Markdown body', async () =>
  fixture(async (file) => {
    await createDocument(file, data, '');
    const header = [
      '---',
      '# 作者备注',
      'slug: test',
      'title: 测试',
      'description: 摘要',
      'draft: true # 待发布',
      'publishedAt: "2026-11-01T09:00:00+08:00" # 首发时间',
      'tags:',
      '  # 分类说明',
      '  - 随笔',
      '---',
      '',
    ].join('\r\n');
    const body = '\r\n正文  \r\n\r\n';
    await writeFile(file, header + body);
    const output = await publishDocument(file, 'writing', data.publishedAt);
    await publishDocument(output.file, 'writing');
    const result = await readDocument(output.file);
    for (const comment of [
      '# 作者备注',
      '# 待发布',
      '# 首发时间',
      '# 分类说明',
    ])
      assert.ok(result.raw.includes(comment));
    assert.ok(result.raw.startsWith('---\r\n'));
    assert.deepEqual(result.data.tags, ['随笔']);
    assert.equal(result.body, body);
    assert.equal(result.data.draft, false);
    assert.ok(result.data.updatedAt);
  }));

test('audio and monthly publications lock each entry through its update', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'linsto-scheduled-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const future = '2099-01-01T00:00:00+08:00';
  for (const kind of ['audio', 'now']) {
    const file = path.join(
      dir,
      kind,
      kind === 'now' ? '2026-11.md' : 'episode/index.md',
    );
    const entry =
      kind === 'now'
        ? {
            ...data,
            period: '2026-11',
            notes: [{ title: '近况', text: '正文' }],
          }
        : {
            ...data,
            kind: 'podcast',
            uid: 'episode',
            series: 'show',
            listen: [{ platform: '站点', url: 'https://example.org/episode' }],
          };
    await createDocument(file, entry, '');
    const lock = path.join(
      path.dirname(file),
      '.' + path.basename(file) + '.authoring.lock',
    );
    await writeFile(lock, 'writer');
    await assert.rejects(publishDocument(file, kind, future), /写入正在进行/);
    assert.equal((await readDocument(file)).data.draft, true);
    await rm(lock);
    await Promise.all([
      publishDocument(file, kind, future),
      publishDocument(file, kind),
    ]);
    assert.equal((await readDocument(file)).data.publishedAt, future);
    await publishDocument(file, kind);
    assert.equal((await readDocument(file)).data.publishedAt, future);
  }
});

test('both audio CLIs reject a slug used by an imported entry before uploading', async (t) => {
  const project = await createTestProject();
  t.after(project.dispose);
  const existing = project.content('audio/imported/episode/index.md');
  await createDocument(
    existing,
    {
      ...data,
      kind: 'podcast',
      uid: 'episode',
      series: 'field-notes',
      slug: 'occupied',
    },
    '',
  );
  const standard = ['--title', '节目', '--description', '简介'];
  const conflict = { status: 1, stderr: /声音 slug 已存在：occupied/ };
  assert.throws(
    () =>
      project.cli(
        'content',
        'new',
        'audio',
        'occupied',
        ...standard,
        '--series',
        'field-notes',
        '--platform',
        '站点',
        '--listen-url',
        'https://example.org/episode',
      ),
    conflict,
  );
  assert.throws(
    () =>
      project.cli(
        'audio',
        '--slug',
        'occupied',
        ...standard,
        '--file',
        'not-needed.webm',
      ),
    conflict,
  );
  await assert.rejects(stat(project.content('audio/occupied/index.md')), {
    code: 'ENOENT',
  });
});

test('series creation validates metadata before writing its JSON file', async (t) => {
  const project = await createTestProject();
  t.after(project.dispose);
  const createSeries = (description: string) =>
    project.cli(
      'content',
      'new',
      'series',
      'new-show',
      '--title',
      '节目',
      '--description',
      description,
    );
  const json = project.content('series/new-show.json');
  assert.throws(() => createSeries('   '), { status: 1 });
  await assert.rejects(stat(json), { code: 'ENOENT' });
  createSeries('简介');
  assert.equal(JSON.parse(await readFile(json, 'utf8')).description, '简介');
});

test('audio writers reserve the same slug before invoking an upload', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'linsto-audio-slug-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let writes = 0;
  const write = () =>
    withNewAudio(dir, 'episode', async (file) => {
      writes++;
      await createDocument(file, { slug: 'episode' }, '');
    });
  const results = await Promise.allSettled([write(), write()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(writes, 1);
});
