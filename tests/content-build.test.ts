import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it, test } from 'node:test';
import sharp from 'sharp';
import parseSrcset from '@prettier/parse-srcset';
import { writeEditorialDrafts } from './fixtures/editorial.mjs';
import { attr, elements, textOf } from './helpers/html.ts';
import { createTestProject } from './helpers/project.mjs';
import { audioItems } from './helpers/rss.mjs';
import { createDocument } from '../scripts/lib.mjs';

describe('publishing and rebuilding the same site', () => {
  let site: Awaited<ReturnType<typeof createTestProject>>;
  let drafts: Awaited<ReturnType<typeof writeEditorialDrafts>>['drafts'];
  let initialWriting: string, initialAudio: string;
  before(async () => {
    site = await createTestProject();
    const scenario = await writeEditorialDrafts(site);
    drafts = scenario.drafts;
    site.build();
    initialWriting = await site.page('writing');
    initialAudio = await site.page('audio');
    await scenario.publish();
    site.build();
  });
  after(() => site?.dispose());

  it('creates editable drafts with optional conversation metadata', () => {
    for (const doc of [drafts.episode, drafts.question, drafts.note])
      assert.equal(doc.data.draft, true);
    assert.equal(drafts.episode.data.series, 'field-notes');
    assert.equal(drafts.question.body.trim(), '');
    assert.equal(drafts.note.body.trim(), '');
    assert.equal(drafts.note.data.category, 'prompted');
    assert.equal(drafts.note.data.conversation, undefined);
  });

  it('keeps drafts and scheduled essays out of public routes, feeds and lists', async () => {
    const documents = await Promise.all(
      [
        'index.html',
        'writing/index.html',
        'archive/index.html',
        'rss.xml',
        'sitemap.xml',
      ].map((file) => readFile(path.join(site.output, file), 'utf8')),
    );
    for (const slug of ['draft-essay', 'future-essay']) {
      await assert.rejects(
        stat(path.join(site.output, 'writing', slug, 'index.html')),
        { code: 'ENOENT' },
      );
      for (const doc of documents) assert.ok(!doc.includes(slug), slug);
    }
    assert.doesNotMatch(initialWriting, /对话测试|data-filter="prompted"/);
    for (const doc of documents.slice(1))
      assert.ok(doc.includes('/writing/a-question/'));
  });

  it('uses the automatic excerpt before publication and the edited excerpt after rebuilding', async () => {
    function excerpt(html: string) {
      const panel = elements(html, 'div').find(
        (el) => attr(el, 'id') === 'fragment-copy',
      );
      assert.ok(panel);
      return textOf(elements(panel, 'p')[0]).trim();
    }
    assert.equal(excerpt(initialWriting), '自动摘录的第二段。');
    assert.equal(excerpt(await site.page('writing')), '手选的一句。');
    assert.match(initialWriting, /data-filter="自定义标签"/);
  });

  it('renders the article body once and optimizes its captioned local image', async () => {
    const html = await site.page('writing/essay');
    assert.ok(
      elements(html, 'meta').some(
        (el) =>
          attr(el, 'name') === 'description' &&
          attr(el, 'content') === '原文首段。',
      ),
    );
    assert.ok(
      elements(html, 'meta').some(
        (el) =>
          attr(el, 'data-pagefind-filter') === 'type[content]' &&
          attr(el, 'content') === 'writing',
      ),
    );
    const body = elements(html, 'div').find((el) =>
      attr(el, 'class')?.split(/\s+/).includes('article-body'),
    );
    assert.ok(body);
    assert.equal(textOf(body).split('原文首段。').length - 1, 1);
    const figure = elements(body, 'figure')[0];
    assert.equal(textOf(elements(figure, 'figcaption')[0]), '测试图注');
    const [image] = elements(elements(figure, 'button')[0], 'img');
    assert.equal(attr(image, 'width'), '900');
    assert.match(attr(image, 'src')!, /^\/_astro\//);
  });

  it('serves eager, responsive artwork and shares variants when pages use the same source', async () => {
    const original = path.join(site.directory, 'public/images/landscape.png');
    const originalSize = (await stat(original)).size;
    let homeVariants: string[] = [];
    for (const [route, className] of [
      ['', 'home-artwork'],
      ['about', 'about-artwork'],
    ]) {
      const picture = elements(await site.page(route), 'picture').find((el) =>
        attr(el, 'class')?.split(/\s+/).includes(className),
      );
      assert.ok(picture, route);
      const preview = attr(picture, 'style')?.match(
        /data:image\/webp;base64,([A-Za-z0-9+/=]+)/,
      )?.[1];
      assert.ok(preview && Buffer.from(preview, 'base64').byteLength < 1024);
      const [image] = elements(picture, 'img');
      const [avif] = elements(picture, 'source');
      assert.equal(attr(avif, 'type'), 'image/avif');
      assert.equal(attr(image, 'fetchpriority'), 'high');
      assert.equal(attr(image, 'loading'), 'eager');
      assert.match(attr(image, 'src')!, /^\/_astro\//);
      if (route === '') assert.equal(attr(image, 'alt'), '');
      else {
        assert.match(attr(image, 'sizes')!, /480px/);
        assert.equal(attr(image, 'data-home-art'), undefined);
      }
      const variants: string[] = [];
      for (const [el, format] of [
        [avif, 'avif'],
        [image, 'webp'],
      ] as const) {
        const candidates = parseSrcset(attr(el, 'srcset')!);
        const widths: number[] = [];
        for (const candidate of candidates) {
          const url = candidate.source.value;
          variants.push(url);
          if (route) continue;
          const file = path.join(site.output, url);
          const asset = await sharp(file).metadata();
          assert.ok(asset.width && asset.height);
          assert.equal(candidate.width?.value, asset.width);
          assert.ok(url.endsWith('.' + format));
          assert.ok((await stat(file)).size < originalSize);
          assert.ok(Math.abs(asset.width / asset.height - 900 / 480) < 0.01);
          widths.push(asset.width);
        }
        if (!route)
          assert.deepEqual(
            widths.sort((a, b) => a - b),
            [480, 640, 900],
          );
      }
      if (!route) homeVariants = variants.sort();
      else assert.deepEqual(variants.sort(), homeVariants);
    }
  });

  it('publishes both structured conversations and free-form prompted notes', async () => {
    const html = await site.page('writing/a-question');
    const source = elements(html, 'span').find(
      (el) => attr(el, 'class') === 'article-source',
    );
    assert.ok(source);
    assert.match(textOf(source), /Claude.*测试模型/s);
    assert.ok(
      elements(html, 'a').some(
        (el) => attr(el, 'href') === 'https://example.org/conversation',
      ),
    );
    const turns = elements(html, 'section').filter((el) =>
      attr(el, 'data-speaker'),
    );
    assert.deepEqual(
      turns.map((el) => [attr(el, 'data-speaker'), attr(el, 'aria-label')]),
      [
        ['user', '我'],
        ['assistant', 'Claude · 回答整理'],
      ],
    );
    assert.equal(textOf(elements(turns[1], 'h2')[0]), '一个解释');
    assert.match(textOf(elements(turns[1], 'blockquote')[0]), /保留下来的原话/);
    assert.match(textOf(turns[1]), /自由编排的正文/);
    const free = await site.page('writing/open-note');
    assert.match(free, /今天只记下一句话。/);
    assert.doesNotMatch(
      free,
      /class="article-source"|data-speaker=|我的提问|我的思考与收获/,
    );
    assert.match(await site.page('writing'), /data-filter="prompted"/);
  });

  it('lists published shows and standalone recordings with the appropriate listening controls', async () => {
    assert.doesNotMatch(initialAudio, /溪边电台/);
    assert.match(
      initialAudio,
      /class="cover-title">\s*声音\s*<br\s*\/?>\s*手记/,
    );
    assert.match(initialAudio, /data-filter="kind:recording"/);
    const listing = await site.page('audio');
    const show = elements(listing, 'button').find(
      (el) => attr(el, 'data-filter') === 'field-notes',
    );
    assert.ok(show);
    assert.deepEqual(JSON.parse(attr(show, 'data-legacy-tags')!), ['溪边电台']);
    assert.doesNotMatch(listing, /未公开栏目/);
    for (const slug of ['episode', 'recording'])
      assert.ok(listing.includes('/audio/' + slug + '/'));
    assert.match(await site.page('audio/recording'), /data-audio-player/);
    const external = await site.page('audio/episode');
    assert.match(external, /去小宇宙收听/);
    assert.ok(
      elements(external, 'a').some(
        (el) => attr(el, 'href') === 'https://example.org/listen/episode',
      ),
    );
    assert.doesNotMatch(external, /data-audio-player|id="play"/);
    assert.ok(
      elements(external, 'meta').some(
        (el) =>
          attr(el, 'data-pagefind-filter') === 'type[content]' &&
          attr(el, 'content') === 'audio',
      ),
    );
  });

  it('puts exactly the two playable items in audio RSS with stable GUIDs and complete enclosures', async () => {
    const feed = await readFile(
      path.join(site.output, 'audio/rss.xml'),
      'utf8',
    );
    const items = audioItems(feed).sort((a, b) => a.guid.localeCompare(b.guid));
    assert.deepEqual(items, [
      {
        guid: 'stable-hosted-guid',
        isPermaLink: 'false',
        enclosures: [
          {
            url: 'https://media.example.org/show.ogg?part=1&v=2',
            length: '4567',
            type: 'audio/ogg',
          },
        ],
      },
      {
        guid: 'stable-recording-guid',
        isPermaLink: 'false',
        enclosures: [
          {
            url: 'https://media.example.org/recording.mp3',
            length: '1234',
            type: 'audio/mpeg',
          },
        ],
      },
    ]);
  });
});

test('a conflicting draft fails a real production build', async (t) => {
  const site = await createTestProject();
  t.after(site.dispose);
  for (const [uid, draft] of [
    ['first-id', false],
    ['draft-id', true],
  ] as const)
    await createDocument(
      site.content('audio/' + uid + '/index.md'),
      {
        uid,
        slug: 'same-episode',
        draft,
        kind: 'podcast',
        series: 'field-notes',
        title: '单集',
        description: '简介',
        publishedAt: '2000-01-01T09:00:00+08:00',
        listen: [{ platform: '平台', url: 'https://example.org/listen' }],
      },
      '',
    );
  assert.throws(
    site.build,
    (error: Error & { stdout?: string; stderr?: string }) =>
      (error.message + error.stdout + error.stderr).includes('重复的声音地址'),
  );
});
