import test from 'node:test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {
  readFile,
  rm,
  copyFile,
  stat,
  writeFile,
  readdir,
} from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createDocument, readDocument } from '../scripts/lib.mjs';
import { writingDirectory } from '../src/lib/publication.ts';
import { createTestProject, repository as root } from './helpers/project.mjs';

test(
  'production builds render public content, responsive artwork and audio categories',
  { timeout: 90000 },
  async () => {
    const id = 'qa-' + randomUUID().slice(0, 8);
    const fixture = await createTestProject();
    const { directory: project, output, build } = fixture;
    const fixtures = ['draft', 'future', 'public'].map((type) =>
      path.join(
        project,
        'content/writing',
        writingDirectory(
          `${id}-${type}`,
          new Date(
            type === 'future'
              ? '2099-01-01T00:00:00+08:00'
              : '2000-01-01T00:00:00+08:00',
          ),
        ),
      ),
    );
    const recording = path.join(project, 'content/audio', id);
    try {
      await writeFile(
        path.join(project, 'content/series/unpublished.json'),
        JSON.stringify({ title: '未公开栏目', description: '留待发布' }),
      );
      const audioData = {
        slug: id,
        uid: id,
        title: id,
        description: '录音检查',
        kind: 'recording',
        publishedAt: '2000-01-01T00:00:00+08:00',
        draft: false,
        duration: 10,
        src: 'https://example.org/recording.mp3',
        bytes: 1234,
        mime: 'audio/mpeg',
      };
      await createDocument(path.join(recording, 'index.md'), audioData, '');
      const episodeFile = path.join(project, 'content/audio/episode/index.md');
      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'new',
          'audio',
          'episode',
          '--title',
          '栏目测试',
          '--series',
          'thirty-plus',
          '--platform',
          '小宇宙',
          '--listen-url',
          'https://www.xiaoyuzhoufm.com/episode/test',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      const draftEpisode = await readFile(episodeFile, 'utf8');
      assert.match(draftEpisode, /draft: true/);
      assert.match(draftEpisode, /thirty-plus/);
      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'new',
          'prompted',
          'a-question',
          '--title',
          '对话测试',
          '--assistant',
          'Claude',
          '--model',
          '测试模型',
          '--conversation-url',
          'https://example.org/conversation',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      const promptedBundle = (
        await readdir(path.join(project, 'content/writing'))
      ).find((name) => name.endsWith('-a-question'))!;
      const promptedDraft = await readFile(
        path.join(project, 'content/writing', promptedBundle, 'index.md'),
        'utf8',
      );
      assert.match(promptedDraft, /draft: true/);
      const promptedFile = path.join(
        project,
        'content/writing',
        promptedBundle,
        'index.md',
      );
      assert.equal((await readDocument(promptedFile)).body.trim(), '');
      await writeFile(
        promptedFile,
        promptedDraft +
          '\n**我：**\n\n一个还没想明白的问题。\n\n**AI：** *回答整理*\n\n## 一个解释\n\n> 保留下来的原话。\n\n自由编排的正文。\n\n---\n\n自己的笔记。\n',
      );
      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'new',
          'writing',
          'open-note',
          '--category',
          'prompted',
          '--title',
          '自由记录',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      const openBundle = (
        await readdir(path.join(project, 'content/writing'))
      ).find((name) => name.endsWith('-open-note'))!;
      const openFile = path.join(
        project,
        'content/writing',
        openBundle,
        'index.md',
      );
      const openDraft = await readDocument(openFile);
      assert.equal(openDraft.data.category, 'prompted');
      assert.equal(openDraft.data.conversation, undefined);
      assert.equal(openDraft.body.trim(), '');
      await writeFile(openFile, openDraft.raw + '\n今天只记下一句话。\n');
      for (const [index, kind] of ['draft', 'future', 'public'].entries()) {
        const data = {
          slug: `${id}-${kind}`,
          title: `${id}-${kind}`,
          description: '原文首段。',
          category: '测试',
          tags: ['自定义标签'],
          publishedAt:
            kind === 'future'
              ? '2099-01-01T00:00:00+08:00'
              : '2000-01-01T00:00:00+08:00',
          ...(kind === 'draft' ? {} : { draft: false }),
        };
        await createDocument(
          path.join(fixtures[index], 'index.md'),
          data,
          kind === 'public'
            ? '原文首段。\n\n自动摘录的第二段。\n\n![山景](./photo.webp "测试图注")'
            : `正文 ${id}-${kind}`,
        );
      }
      await copyFile(
        path.join(root, 'public/images/ridgelines.webp'),
        path.join(fixtures[2], 'photo.webp'),
      );
      build();
      const home = await readFile(path.join(output, 'index.html'), 'utf8');
      const artwork = home.match(
        /<picture\b[^>]*class="home-artwork[^"]*"[\s\S]*?<\/picture>/,
      )?.[0];
      assert.ok(
        artwork,
        'The homepage must include its artwork in the initial HTML',
      );
      const preview = artwork.match(
        /data:image\/webp;base64,([A-Za-z0-9+/=]+)/,
      )?.[1];
      assert.ok(
        preview,
        'The artwork preview must be available without another request',
      );
      assert.ok(Buffer.from(preview, 'base64').byteLength < 1024);
      assert.match(artwork, /<source[^>]*type="image\/avif"/);
      assert.match(artwork, /<img[^>]*alt(?:="")?\s/);
      assert.match(artwork, /loading="eager"/);
      assert.match(artwork, /fetchpriority="high"/);
      assert.doesNotMatch(artwork, /src="\/images\/ridgelines\.webp"/);
      const originalBytes = (
        await stat(path.join(project, 'public/images/ridgelines.webp'))
      ).size;
      const variants = [
        ...new Set(artwork.match(/\/_astro\/[^"\s,]+\.(?:avif|webp)/g)),
      ];
      for (const format of ['avif', 'webp']) {
        const dimensions = [];
        for (const url of variants.filter((url) =>
          url.endsWith(`.${format}`),
        )) {
          const file = path.join(output, url);
          const metadata = await sharp(file).metadata();
          dimensions.push(metadata.width);
          assert.ok((await stat(file)).size < originalBytes);
          assert.ok(
            Math.abs(metadata.width! / metadata.height! - 900 / 480) < 0.01,
          );
        }
        assert.deepEqual(
          dimensions.sort((a, b) => a! - b!),
          [480, 640, 900],
        );
      }
      const about = await readFile(
        path.join(output, 'about/index.html'),
        'utf8',
      );
      const aboutArtwork = about.match(
        /<picture\b[^>]*class="about-artwork[^\"]*"[\s\S]*?<\/picture>/,
      )?.[0];
      assert.ok(aboutArtwork, 'The about page must use responsive artwork');
      assert.match(aboutArtwork, /data:image\/webp;base64,/);
      assert.match(aboutArtwork, /<source[^>]*type="image\/avif"/);
      assert.match(aboutArtwork, /sizes="[^"]*480px"/);
      assert.match(aboutArtwork, /fetchpriority="high"/);
      assert.doesNotMatch(aboutArtwork, /src="\/images\/ridgelines\.webp"/);
      assert.doesNotMatch(aboutArtwork, /data-home-art/);
      const aboutVariants = [
        ...new Set(aboutArtwork.match(/\/_astro\/[^"\s,]+\.(?:avif|webp)/g)),
      ];
      assert.deepEqual(
        aboutVariants.sort(),
        variants.sort(),
        'Home and about must share the same cacheable image variants',
      );
      await assert.rejects(
        stat(path.join(output, 'writing', `${id}-draft/index.html`)),
      );
      await assert.rejects(
        stat(path.join(output, 'writing', `${id}-future/index.html`)),
      );
      for (const file of [
        'index.html',
        'writing/index.html',
        'archive/index.html',
        'rss.xml',
        'sitemap.xml',
      ]) {
        const html = await readFile(path.join(output, file), 'utf8');
        assert.ok(
          !html.includes(`${id}-draft`) && !html.includes(`${id}-future`),
          `Private content leaked into ${file}`,
        );
      }
      const audioListing = await readFile(
        path.join(output, 'audio/index.html'),
        'utf8',
      );
      assert.match(
        audioListing,
        /class="cover-title">\s*声音\s*<br\s*\/?>\s*手记\s*<\/span>/,
      );
      assert.doesNotMatch(audioListing, /老大不小/);
      assert.match(audioListing, /data-filter="声音手记"/);
      assert.ok(audioListing.includes(`href="/audio/${id}/"`));
      const recordingPage = await readFile(
        path.join(output, 'audio', id, 'index.html'),
        'utf8',
      );
      assert.match(recordingPage, /声音手记/);
      assert.match(recordingPage, /data-audio-player/);
      const listing = await readFile(
        path.join(output, 'writing/index.html'),
        'utf8',
      );
      assert.doesNotMatch(listing, /对话测试|data-filter="prompted"/);
      assert.match(
        listing,
        /id="fragment-copy"[^>]*>\s*<p>自动摘录的第二段。<\/p>/,
      );
      assert.match(listing, /data-filter="自定义标签"/);
      const article = await readFile(
        path.join(output, 'writing', `${id}-public/index.html`),
        'utf8',
      );
      assert.match(article, /<meta name="description" content="原文首段。"/);
      assert.match(
        article,
        /data-pagefind-filter="type\[content\]" content="writing"/,
      );
      const body = article
        .split(/<div class="article-body(?:\s[^"]*)?">/)[1]
        ?.split('</article>')[0];
      assert.ok(body, 'The rendered article must contain its reading body');
      assert.equal(body.split('原文首段。').length - 1, 1);
      assert.match(article, /class="image-open"/);
      assert.match(article, /src="\/_astro\/[^"]+"/);
      assert.match(article, /<img[^>]+width="900"/);
      assert.match(article, /<figcaption>测试图注<\/figcaption>/);

      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'publish',
          'audio/episode/index.md',
          '--date',
          '2000-01-02T00:00:00+08:00',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      const postFile = path.join(fixtures[2], 'index.md');
      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'publish',
          `writing/${promptedBundle}/index.md`,
          '--date',
          '1999-12-31T09:00:00+08:00',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      const post = await readFile(postFile, 'utf8');
      execFileSync(
        process.execPath,
        [
          path.join(project, 'scripts/content.mjs'),
          'publish',
          `writing/${openBundle}/index.md`,
          '--date',
          '1999-12-30T09:00:00+08:00',
        ],
        { cwd: project, stdio: 'pipe' },
      );
      await writeFile(
        postFile,
        post.replace(/^---/, '---\nfeaturedExcerpt: "手选的一句。"').trimEnd() +
          '\n\n手选的一句。\n',
      );
      build();
      const podcastListing = await readFile(
        path.join(output, 'audio/index.html'),
        'utf8',
      );
      assert.match(podcastListing, /data-filter="老大不小"/);
      assert.match(podcastListing, /href="\/audio\/episode\/"/);
      assert.match(podcastListing, /data-filter="声音手记"/);
      const externalPage = await readFile(
        path.join(output, 'audio/episode/index.html'),
        'utf8',
      );
      assert.match(externalPage, /去小宇宙收听/);
      assert.match(
        externalPage,
        /data-pagefind-filter="type\[content\]" content="audio"/,
      );
      assert.match(
        externalPage,
        /href="https:\/\/www.xiaoyuzhoufm.com\/episode\/test"/,
      );
      assert.doesNotMatch(externalPage, /data-audio-player|id="play"/);
      const feed = await readFile(path.join(output, 'audio/rss.xml'), 'utf8');
      assert.match(feed, /recording.mp3/);
      assert.doesNotMatch(feed, /xiaoyuzhoufm.com\/episode\/test/);
      assert.doesNotMatch(podcastListing, /未公开栏目/);
      const curatedListing = await readFile(
        path.join(output, 'writing/index.html'),
        'utf8',
      );
      assert.match(curatedListing, /data-filter="prompted"/);
      const conversationPage = await readFile(
        path.join(output, 'writing/a-question/index.html'),
        'utf8',
      );
      assert.match(conversationPage, /class="article-source"/);
      assert.match(conversationPage, /Claude/);
      assert.match(conversationPage, /测试模型/);
      assert.match(
        conversationPage,
        /href="https:\/\/example.org\/conversation"/,
      );
      assert.match(conversationPage, /data-speaker="user" aria-label="我"/);
      assert.match(
        conversationPage,
        /data-speaker="assistant" aria-label="Claude · 回答整理"/,
      );
      assert.match(conversationPage, /<h2[^>]*>一个解释<\/h2>/);
      assert.match(conversationPage, /<blockquote>\s*<p>/);
      assert.match(conversationPage, /自由编排的正文。/);
      const openPage = await readFile(
        path.join(output, 'writing/open-note/index.html'),
        'utf8',
      );
      assert.match(openPage, /今天只记下一句话。/);
      assert.doesNotMatch(
        openPage,
        /与 AI 对话|class="article-source"|class="dialogue-turn"|我的提问|我的思考与收获/,
      );
      for (const file of ['rss.xml', 'sitemap.xml', 'archive/index.html'])
        assert.match(
          await readFile(path.join(output, file), 'utf8'),
          /\/writing\/a-question\//,
        );
      assert.match(
        curatedListing,
        /id="fragment-copy"[^>]*>\s*<p>手选的一句。<\/p>/,
      );
      const duplicate = path.join(project, 'content/audio/copy/index.md');
      for (const draft of [false, true]) {
        await rm(path.dirname(duplicate), { recursive: true, force: true });
        await createDocument(
          duplicate,
          { ...audioData, uid: 'different-uid', draft },
          '复制的单集',
        );
        assert.throws(build, (error: unknown) => {
          const failure = error as Error & { stdout?: Buffer; stderr?: Buffer };
          return /重复的声音地址/.test(
            `${failure.message} ${failure.stdout} ${failure.stderr}`,
          );
        });
      }
    } finally {
      await fixture.dispose();
    }
  },
);
