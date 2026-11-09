import { stat } from 'node:fs/promises';
import path from 'node:path';
import { validateBuild } from './build-validation.mjs';
import { site } from '../src/lib/site.ts';
const root = path.resolve('dist');
const count = await validateBuild(root, process.env.SITE_URL || site.url);
for (const file of [
  'pagefind/pagefind.js',
  'rss.xml',
  'audio/rss.xml',
  'sitemap.xml',
  'robots.txt',
  '404.html',
])
  await stat(path.join(root, file));
console.log(
  `构建校验通过：${count} 个站内链接、资源及锚点，搜索索引及订阅文件齐全。`,
);
