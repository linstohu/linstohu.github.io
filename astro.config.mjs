import { defineConfig } from 'astro/config';
import { existsSync } from 'node:fs';

import { unified } from '@astrojs/markdown-remark';
import rehypeFigures from './src/lib/rehype-figures.mjs';
import { site } from './src/lib/site.ts';

const localEnv = new URL('.env', import.meta.url);
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export default defineConfig({
  site: process.env.SITE_URL || site.url,
  output: 'static',
  trailingSlash: 'always',
  prerenderConflictBehavior: 'error',
  markdown: { processor: unified({ rehypePlugins: [rehypeFigures] }) },
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Preserve min/max media queries for older Android browser engines.
      cssTarget: ['chrome87', 'safari14'],
    },
  },
});
