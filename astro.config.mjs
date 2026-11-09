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
  markdown: { processor: unified({ rehypePlugins: [rehypeFigures] }) },
  devToolbar: { enabled: false },
});
