import test from 'node:test';
import assert from 'node:assert/strict';
import { writingSchema, audioSchema, nowSchema } from '../src/lib/schemas.ts';
import {
  isPublished,
  validateContentGraph,
  writingDirectory,
} from '../src/lib/publication.ts';
const post = {
  slug: 'an-essay',
  title: '文章',
  description: '一句摘要',
  category: '随笔',
  publishedAt: '2026-11-09T09:00:00+08:00',
};

test('omitting draft cannot publish new content accidentally', () => {
  const data = writingSchema.parse(post);
  assert.equal(data.draft, true);
  assert.equal(isPublished(data, Date.parse('2026-11-10T00:00:00Z')), false);
});
test('scheduled posts enter production only after their publication time', () => {
  const data = writingSchema.parse({ ...post, draft: false });
  assert.equal(isPublished(data, Date.parse(post.publishedAt) - 1), false);
  assert.equal(isPublished(data, Date.parse(post.publishedAt)), true);
});
test('ambiguous dates and whitespace-only metadata are rejected', () => {
  assert.equal(
    writingSchema.safeParse({ ...post, publishedAt: '2026-11-09' }).success,
    false,
  );
  assert.equal(
    writingSchema.safeParse({ ...post, title: '  ' }).success,
    false,
  );
});
test('published real audio needs an address, enclosure metadata and ordered chapters', () => {
  const recording = {
    ...post,
    uid: 'stable-id',
    kind: 'recording',
    duration: 60,
  };
  assert.equal(
    audioSchema.safeParse({ ...recording, draft: false }).success,
    false,
  );
  const valid = {
    ...recording,
    draft: false,
    src: 'https://media.example.org/voice.mp3',
    bytes: 128000,
    mime: 'audio/mpeg',
  };
  assert.equal(audioSchema.safeParse(valid).success, true);
  for (const draft of [true, false])
    assert.equal(
      audioSchema.safeParse({ ...valid, draft, series: 'thirty-plus' }).success,
      false,
    );
  assert.equal(
    audioSchema.safeParse({
      ...valid,
      chapters: [
        { time: 40, title: '后' },
        { time: 10, title: '前' },
      ],
    }).success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({ ...valid, chapters: [{ time: 60, title: '越界' }] })
      .success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({ ...valid, mime: 'text/plain' }).success,
    false,
  );
});
test('snapshots need a real month and at least one note', () => {
  assert.equal(
    nowSchema.safeParse({
      ...post,
      period: '2026-13',
      notes: [{ title: '此刻', text: '内容' }],
    }).success,
    false,
  );
  assert.equal(
    nowSchema.safeParse({ ...post, period: '2026-11', notes: [] }).success,
    false,
  );
});
test('duplicate permalinks and broken content references fail before deployment', () => {
  const graph = {
    writing: [
      {
        id: '2026-11-09-an-essay',
        data: { slug: 'an-essay', publishedAt: new Date(post.publishedAt) },
      },
    ],
    audio: [],
    now: [],
    series: [],
  };
  assert.throws(
    () =>
      validateContentGraph({
        ...graph,
        writing: [...graph.writing, ...graph.writing],
      }),
    /重复/,
  );
  assert.throws(
    () =>
      validateContentGraph({
        ...graph,
        now: [{ id: '2026-10', data: { period: '2026-11' } }],
      }),
    /文件名/,
  );
  assert.throws(
    () =>
      validateContentGraph({
        ...graph,
        audio: [
          {
            data: {
              slug: 'sound',
              uid: 'id',
              series: 'missing',
              relatedWriting: [],
            },
          },
        ],
      }),
    /节目/,
  );
  assert.throws(
    () =>
      validateContentGraph({
        ...graph,
        audio: [
          { data: { slug: 'sound', uid: 'id', relatedWriting: ['missing'] } },
        ],
      }),
    /文章/,
  );
});

test('platform episodes publish with listening links while recordings require playable media', () => {
  const external = {
    ...post,
    uid: 'external',
    kind: 'podcast',
    series: 'thirty-plus',
    draft: false,
    listen: [
      { platform: '小宇宙', url: 'https://www.xiaoyuzhoufm.com/episode/test' },
    ],
  };
  assert.equal(audioSchema.safeParse(external).success, true);
  assert.equal(
    audioSchema.safeParse({ ...external, listen: [] }).success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({ ...external, series: undefined }).success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({ ...external, kind: 'recording', series: undefined })
      .success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({
      ...external,
      listen: [{ platform: '小宇宙', url: 'javascript:alert(1)' }],
    }).success,
    false,
  );
  assert.equal(
    audioSchema.safeParse({
      ...external,
      chapters: [{ time: 0, title: '开场' }],
    }).success,
    false,
  );
});

test('article directory validation follows the Shanghai date and metadata slug', () => {
  const date = new Date('2026-11-09T18:00:00Z');
  assert.equal(writingDirectory('test', date), '2026-11-10-test');
  assert.throws(
    () =>
      validateContentGraph({
        writing: [
          { id: '2026-11-09-test', data: { slug: 'test', publishedAt: date } },
        ],
        audio: [],
        now: [],
        series: [],
      }),
    /目录.*2026-11-10-test/,
  );
});
