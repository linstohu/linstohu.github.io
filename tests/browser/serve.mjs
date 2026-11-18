import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { astroCLI, createTestProject, fixtures } from '../helpers/project.mjs';
import { createDocument } from '../../scripts/lib.mjs';

const origin = new URL(process.argv[2]);
const project = await createTestProject();
let server;
let stopping = false;
function stop() {
  stopping = true;
  server?.kill('SIGTERM');
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
try {
  await cp(path.join(fixtures, 'browser/content'), project.content(''), {
    recursive: true,
  });
  const wav = path.join(project.directory, 'public/playback.wav');
  await copyFile(path.join(fixtures, 'media/playback.wav'), wav);
  const bytes = (await stat(wav)).size;
  for (const [slug, title, file] of [
    ['field-recording', '站内试听', 'playback.wav'],
    ['unavailable', '暂时下架的录音', 'missing-playback.wav'],
  ])
    await createDocument(
      project.content('audio/' + slug + '/index.md'),
      {
        slug,
        uid: slug,
        title,
        description: '一段带章节的录音。',
        kind: 'recording',
        draft: false,
        publishedAt: '1999-01-01T09:00:00+08:00',
        src: new URL(file, origin).href,
        duration: 12,
        bytes,
        mime: 'audio/wav',
        chapters: [
          { time: 0, title: '开场' },
          { time: 5, title: '第二章' },
        ],
      },
      '用于验证站内播放控件。',
    );
  if (!stopping) {
    project.build();
    project.index();
    server = spawn(
      process.execPath,
      [
        astroCLI,
        'preview',
        '--host',
        origin.hostname,
        '--port',
        origin.port,
        '--ignore-lock',
      ],
      {
        cwd: project.directory,
        stdio: 'inherit',
      },
    );
    const [code, signal] = await once(server, 'exit');
    process.exitCode = code ?? (stopping || signal === 'SIGINT' ? 0 : 1);
  }
} finally {
  await project.dispose();
}
