import path from 'node:path';
import { validateBuild, validateArtifacts } from './build-validation.mjs';
import { site } from '../src/lib/site.ts';
const root = path.resolve('dist');
const count = await validateBuild(root, process.env.SITE_URL || site.url);
await validateArtifacts(root);
console.log(
  `构建校验通过：${count} 个站内链接、资源及锚点，搜索索引及订阅文件齐全。`,
);
