import { appendFile, copyFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument, readDocument } from '../../scripts/lib.mjs';

const firstDay = '2000-01-01T09:00:00+08:00';
const essayBody =
  '原文首段。\n\n自动摘录的第二段。\n\n![山景](./photo.png "测试图注")';
const conversationBody =
  '\n**我：**\n\n一个还没想明白的问题。\n\n**AI：** *回答整理*\n\n## 一个解释\n\n> 保留下来的原话。\n\n自由编排的正文。\n\n---\n\n自己的笔记。\n';

export async function writeEditorialDrafts(project) {
  for (const [slug, day, state] of [
    ['essay', '2000-01-01', { draft: false }],
    ['draft-essay', '2000-01-01', {}],
    ['future-essay', '2099-01-01', { draft: false }],
  ]) {
    await createDocument(
      project.content('writing/' + day + '-' + slug + '/index.md'),
      {
        slug,
        title: slug,
        description: '原文首段。',
        category: '测试',
        tags: ['自定义标签'],
        publishedAt: day + 'T09:00:00+08:00',
        ...state,
      },
      slug === 'essay' ? essayBody : slug,
    );
  }
  const essay = project.content('writing/2000-01-01-essay/index.md');
  await copyFile(
    path.join(project.directory, 'public/images/landscape.png'),
    path.join(path.dirname(essay), 'photo.png'),
  );
  await createDocument(
    project.content('audio/recording/index.md'),
    {
      slug: 'recording',
      uid: 'stable-recording-guid',
      title: '录音检查',
      description: '一段录音',
      kind: 'recording',
      publishedAt: firstDay,
      draft: false,
      duration: 10,
      bytes: 1234,
      src: 'https://media.example.org/recording.mp3',
      mime: 'audio/mpeg',
    },
    '',
  );
  await writeFile(
    project.content('series/unpublished.json'),
    JSON.stringify({ title: '未公开栏目', description: '留待发布' }),
  );
  project.cli(
    'content',
    'new',
    'audio',
    'episode',
    '--title',
    '栏目测试',
    '--series',
    'field-notes',
    '--platform',
    '小宇宙',
    '--listen-url',
    'https://example.org/listen/episode',
  );
  project.cli(
    'content',
    'new',
    'prompted',
    'a-question',
    '--title',
    '对话测试',
    '--assistant',
    'Claude',
    '--model',
    '测试模型',
    '--conversation-url',
    'https://example.org/conversation',
  );
  project.cli(
    'content',
    'new',
    'writing',
    'open-note',
    '--category',
    'prompted',
    '--title',
    '自由记录',
  );

  const bundles = await readdir(project.content('writing'));
  const writingPath = (slug) => {
    const bundle = bundles.find((name) => name.endsWith('-' + slug));
    if (!bundle) throw new Error('Missing draft ' + slug);
    return 'writing/' + bundle + '/index.md';
  };
  const question = writingPath('a-question'),
    note = writingPath('open-note');
  const drafts = {
    episode: await readDocument(project.content('audio/episode/index.md')),
    question: await readDocument(project.content(question)),
    note: await readDocument(project.content(note)),
  };
  await appendFile(project.content(question), conversationBody);
  await appendFile(project.content(note), '\n今天只记下一句话。\n');

  async function publish() {
    for (const [file, date] of [
      ['audio/episode/index.md', '2000-01-02'],
      [question, '1999-12-31'],
      [note, '1999-12-30'],
    ])
      project.cli(
        'content',
        'publish',
        file,
        '--date',
        date + 'T09:00:00+08:00',
      );
    const { raw } = await readDocument(essay);
    await writeFile(
      essay,
      raw.replace(/^---/, '---\nfeaturedExcerpt: "手选的一句。"') +
        '\n手选的一句。\n',
    );
    await createDocument(
      project.content('audio/hosted/index.md'),
      {
        slug: 'hosted',
        uid: 'stable-hosted-guid',
        title: '站内单集',
        description: '有音频的栏目单集',
        kind: 'podcast',
        series: 'field-notes',
        publishedAt: firstDay,
        draft: false,
        duration: 12,
        bytes: 4567,
        mime: 'audio/ogg',
        src: 'https://media.example.org/show.ogg?part=1&v=2',
      },
      '',
    );
  }
  return { drafts, publish };
}
