import { defineConfig } from 'astro/config';
import { existsSync } from 'node:fs';

import { unified } from '@astrojs/markdown-remark';
import remarkSnapshotNotes from './src/lib/remark-snapshot-notes.mjs';
import rehypeFigures from './src/lib/rehype-figures.mjs';
import rehypeDialogue from './src/lib/rehype-dialogue.mjs';
import { site } from './src/lib/site.ts';
import tailwindcss from '@tailwindcss/vite';

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
      rehypePlugins: [rehypeFigures, [rehypeDialogue, { userName: site.name }]],
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
