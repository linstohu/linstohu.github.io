import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createDocument } from '../scripts/lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test(
  'real builds keep drafts private and render article-local images through Astro',
  { timeout: 90000 },
  async () => {
    const id = 'qa-' + randomUUID().slice(0, 8);
    const output = await mkdtemp(path.join(tmpdir(), 'linsto-build-'));
    const fixtures = ['draft', 'future', 'public'].map((type) =>
      path.join(root, 'content/writing', `${id}-${type}`),
    );
    try {
      for (const [index, kind] of ['draft', 'future', 'public'].entries()) {
        const data = {
          slug: `${id}-${kind}`,
          title: `${id}-${kind}`,
          description: '集成检查',
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
            ? '![山景](./photo.png "测试图注")'
            : `正文 ${id}-${kind}`,
        );
      }
      await copyFile(
        path.join(root, 'public/images/ridgelines.png'),
        path.join(fixtures[2], 'photo.png'),
      );
      execFileSync(
        process.execPath,
        [
          path.join(root, 'node_modules/astro/bin/astro.mjs'),
          'build',
          '--outDir',
          output,
        ],
        {
          cwd: root,
          env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
          stdio: 'pipe',
          timeout: 75000,
        },
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
      const listing = await readFile(
        path.join(output, 'writing/index.html'),
        'utf8',
      );
      assert.match(listing, /data-filter="自定义标签"/);
      const article = await readFile(
        path.join(output, 'writing', `${id}-public/index.html`),
        'utf8',
      );
      assert.match(article, /class="image-open"/);
      assert.match(article, /src="\/_astro\/[^"]+"/);
      assert.match(article, /<img[^>]+width="900"/);
      assert.match(article, /<figcaption>测试图注<\/figcaption>/);
    } catch (error) {
      if (error && typeof error === 'object' && 'stderr' in error)
        throw new Error(String(error.stderr));
      throw error;
    } finally {
      for (const fixture of fixtures)
        await rm(fixture, { recursive: true, force: true });
      await rm(output, { recursive: true, force: true });
    }
  },
);
