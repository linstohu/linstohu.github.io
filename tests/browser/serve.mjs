import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
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
      '正文中的共同检索词。',
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
      '声音正文中的共同检索词。',
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
