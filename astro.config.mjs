import { defineConfig } from 'astro/config';
import { hash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { unified } from '@astrojs/markdown-remark';
import remarkSnapshotNotes from './src/lib/remark-snapshot-notes.mjs';
import rehypeFigures from './src/lib/rehype-figures.mjs';
import rehypeDialogue from './src/lib/rehype-dialogue.mjs';
import { site } from './src/lib/site.ts';
import tailwindcss from '@tailwindcss/vite';

// Astro's content cache serializes plugin options and omits plugin functions.
const dialogueCacheKey = hash(
  'sha256',
  ['rehype-dialogue.mjs', 'dialogue-message.mjs']
    .map((file) =>
      readFileSync(new URL('./src/lib/' + file, import.meta.url), 'utf8'),
    )
    .join('\0'),
);

const localEnv = new URL('.env', import.meta.url);
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export default defineConfig({
  site: process.env.SITE_URL || site.url,
  output: 'static',
  trailingSlash: 'always',
  prerenderConflictBehavior: 'error',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkSnapshotNotes],
      rehypePlugins: [
        rehypeFigures,
        [rehypeDialogue, { userName: site.name, cacheKey: dialogueCacheKey }],
      ],
      remarkRehype: {
        footnoteLabel: '注释与出处',
        footnoteLabelProperties: { className: ['footnotes-title'] },
        footnoteBackContent: (_, reference) =>
          reference > 1 ? `返回正文 ${reference} ↩` : '返回正文 ↩',
        footnoteBackLabel: (note, reference) =>
          `返回正文：注释 ${note + 1} 的第 ${reference} 处引用`,
      },
    }),
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
