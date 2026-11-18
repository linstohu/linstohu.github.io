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
    path.join(
      project.directory,
      'content/writing/1999-12-31-a-question/index.md',
    ),
    {
      slug: 'a-question',
      title: '与 AI 的对话',
      description: '从生活里的一个问题出发。',
      category: 'prompted',
      conversation: {
        assistant: 'ChatGPT',
        model: '已知的模型名称',
        url: 'https://example.org/conversation',
      },
      publishedAt: '1999-12-31T09:00:00+08:00',
      draft: false,
    },
    [
      '这是一次与 AI 的对话，回答经过整理。',
      '**我：**',
      'promptedneedles：遇到问题以后，我的第一反应常常是先找责任人，哪怕是自己做错了，也会继续想是谁引发了我做错。这种思维习惯究竟应该如何改变？',
      '**AI：**',
      '## 换一个思考顺序',
      'AI 提供了一个值得考虑的角度，先看看自己可以做什么。',
      ...Array(4).fill(
        '长回答中也需要记得是谁在说话。可以先描述发生了什么，再检查自己当时有哪些选择。思考的时候不急着给出结论，留下观察的余地。',
      ),
      '> 引用仍然是引用，不会变成新的发言。',
      '```md\n**我：**\n' + 'long-code-'.repeat(36) + '\n```',
      '| 部分 | 说明 |\n| --- | --- |\n| 我的选择 | 可以继续观察 |',
      '## 还想继续追问',
      '对话还可以继续，不必急着写出结论。',
      '**我：**',
      '那我先观察下一次的反应。',
      '**AI：**',
      '可以从一件具体的小事开始。',
      '---',
      '这是对话后的笔记。',
    ].join('\n\n'),
  );
  await createDocument(
    path.join(
      project.directory,
      'content/writing/1999-12-30-open-note/index.md',
    ),
    {
      slug: 'open-note',
      title: '随手记下一句话',
      description: '没有固定章节的记录。',
      category: 'prompted',
      publishedAt: '1999-12-30T09:00:00+08:00',
      draft: false,
    },
    '今天只记下一句话。',
  );
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
