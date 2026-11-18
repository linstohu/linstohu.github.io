import { appendFile, writeFile } from 'node:fs/promises';
import { createDocument } from '../../scripts/lib.mjs';

export const hiddenMonths = [
  {
    period: '2025-12',
    title: '未发布的十二月',
    publishedAt: '2025-12-01T09:00:00+08:00',
    draft: true,
    marker: 'draftmonthword',
  },
  {
    period: '2099-01',
    title: '预定的未来月份',
    publishedAt: '2099-01-01T09:00:00+08:00',
    draft: false,
    marker: 'futuremonthword',
  },
];

export async function writeReaderEntries(project) {
  const { content } = project;
  const publishedAt = '2025-11-17T09:00:00+08:00';
  const common = {
    title: '一篇记录',
    description: '内容摘要',
    publishedAt,
    draft: false,
  };

  project.cli(
    'content',
    'new',
    'now',
    '--period',
    '2025-11',
    '--title',
    '本月',
  );
  const monthly = content('now/2025-11.md');
  await appendFile(
    monthly,
    '\n## 正在读\n\n我的 **月度正文**，还有 [一条链接](/about/)。本月记为 publicmonthword。\n',
  );
  project.cli('content', 'publish', 'now/2025-11.md', '--date', publishedAt);
  await createDocument(
    content('now/2024-11.md'),
    {
      ...common,
      period: '2024-11',
      publishedAt: '2024-11-17T09:00:00+08:00',
      notes: [{ title: '读书', text: '读到 `Supported Regions Policy`。' }],
    },
    '这也是正文。',
  );
  await createDocument(
    content('now/2023-11.md'),
    {
      ...common,
      period: '2023-11',
      publishedAt: '2023-11-17T09:00:00+08:00',
    },
    '- 只用列表记录近况。',
  );
  for (const { period, title, publishedAt, draft, marker } of hiddenMonths) {
    await createDocument(
      content('now/' + period + '.md'),
      { period, title, publishedAt, draft },
      marker,
    );
  }
  for (const [id, category] of [
    ['conversation', 'prompted'],
    ['essay', '随笔'],
  ]) {
    await createDocument(
      content('writing/2025-11-17-' + id + '/index.md'),
      {
        ...common,
        slug: id,
        category,
        ...(id === 'conversation' && {
          description: 'orcharddescription',
          tags: ['orchardtag'],
          conversation: { assistant: 'ChatGPT', model: 'orchardmodel' },
        }),
      },
      id === 'conversation'
        ? [
            '**我：**',
            '怎样辨认果树？',
            '**AI：**',
            '先看叶子。',
            '## 叶形',
            'sharedorchard 是小节里的检索词。',
            '### 叶缘',
            'leafmargin 是子小节里的检索词。',
          ].join('\n\n')
        : 'sharedorchard 是正文中的检索词。',
    );
  }
  for (const id of ['recording', 'autumn']) {
    await writeFile(
      content('series/' + id + '.json'),
      JSON.stringify({
        title: '同名栏目',
        description: id,
        listen: [{ platform: '订阅', url: 'https://example.org/' + id }],
      }),
    );
    await createDocument(
      content('audio/' + id + '/index.md'),
      {
        ...common,
        slug: id,
        uid: id,
        kind: 'podcast',
        series: id,
        listen: [
          { platform: '收听', url: 'https://example.org/episode/' + id },
        ],
      },
      'sharedorchard 也出现在播客笔记里。',
    );
  }
  await createDocument(
    content('audio/field-note/index.md'),
    {
      ...common,
      slug: 'field-note',
      uid: 'field-note',
      kind: 'recording',
      src: 'https://example.org/field.mp3',
      bytes: 8000,
      mime: 'audio/mpeg',
      duration: 12,
    },
    'sharedorchard 也出现在独立录音中。',
  );
}
