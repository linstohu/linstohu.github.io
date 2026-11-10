import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createTestProject,
  repository,
  astroCLI,
} from '../helpers/project.mjs';
import { createDocument } from '../../scripts/lib.mjs';

const project = await createTestProject();
let server;
process.once('SIGTERM', () => server?.kill('SIGTERM'));
process.once('SIGINT', () => server?.kill('SIGINT'));
try {
  const articleBody = [
    '正文中的共同检索词。',
    '![文章配图](/images/ridgelines.webp "测试配图说明")',
    '我们都知道算数学题、各门各科的考试费脑子，可是我们却把不快乐、精神郁闷归因于「心理」，我觉得命名不妥。',
    '无论是技术还是艺术，无论是理性还是感性，无论是技战术能力的发挥还是情绪的宣泄，都事关头脑的使用。',
    '于是，人生的最为核心的命题，就有且只有一个了：如何动脑。',
    '网易云音乐：[我的个人主页](https://music.163.com/#/user/home?id=1995560350)（需提前登录）。也可以阅读[另一篇文字](/writing/second/)。',
    '这段文字含有 `inline_code` 和一条很长的[参考链接](https://example.org/reading/reference)。',
    '[https://example.org/' +
      'long-reference-'.repeat(16) +
      '](https://example.org/reading/reference)',
    '> 引用里的长句应当自然换行，保持完整的阅读宽度，不把正文挤成狭窄的一列。',
    '1. 第一条\n2. 第二条',
    '| 项目 | 说明 |\n| --- | --- |\n| 链接 | https://example.org/' +
      'long-cell-'.repeat(12) +
      ' |',
    '```text\n' + 'long_code_line_'.repeat(20) + '\n```',
    '<details>\n<summary>展开补充说明</summary>\n\n补充说明中也可以使用[正文链接](https://example.org/detail)。\n\n</details>',
    '正文中的注释[^reading-note]。\n\n[^reading-note]: 注释内的[来源](https://example.org/source)。',
  ].join('\n\n');
  for (const [index, slug] of ['first', 'second'].entries()) {
    const publishedAt = `2000-01-0${index + 1}T00:00:00+08:00`;
    await createDocument(
      path.join(
        project.directory,
        `content/writing/2000-01-0${index + 1}-${slug}/index.md`,
      ),
      {
        slug,
        title: `测试文章 ${index + 1}`,
        description: '文章摘要',
        category: index === 0 ? '随笔' : '生活',
        publishedAt,
        draft: false,
      },
      articleBody,
    );
    await createDocument(
      path.join(project.directory, `content/audio/${slug}/index.md`),
      {
        slug,
        uid: slug,
        title: `测试声音 ${index + 1}`,
        description: '单集摘要',
        kind: 'podcast',
        series: 'thirty-plus',
        publishedAt,
        draft: false,
        listen: [{ platform: '外部平台', url: 'https://example.org/episode' }],
      },
      '声音正文中的共同检索词。\n\n[声音中的链接](https://example.org/audio)',
    );
  }
  await createDocument(
    path.join(project.directory, 'content/now/2000-01.md'),
    {
      period: '2000-01',
      title: '测试月份',
      publishedAt: '2000-01-01T00:00:00+08:00',
      draft: false,
      notes: [{ title: '正在做', text: '近况中的共同检索词。' }],
    },
    '',
  );
  await appendFile(
    path.join(project.directory, 'content/pages/about.md'),
    '\n\n## 延伸链接\n\n[关于页中的链接](https://example.org/about)\n',
  );
  project.build();
  execFileSync(
    process.execPath,
    [
      path.join(repository, 'node_modules/pagefind/lib/runner/bin.cjs'),
      '--site',
      'dist',
    ],
    {
      cwd: project.directory,
      stdio: 'pipe',
    },
  );
  server = spawn(
    process.execPath,
    [
      astroCLI,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4331',
      '--ignore-lock',
    ],
    {
      cwd: project.directory,
      stdio: 'inherit',
    },
  );
  const [code] = await once(server, 'exit');
  process.exitCode = code ?? 0;
} finally {
  await project.dispose();
}
