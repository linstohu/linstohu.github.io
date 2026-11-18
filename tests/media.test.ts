import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buffer } from 'node:stream/consumers';
import type { Readable } from 'node:stream';
import { S3Client, type PutObjectCommand } from '@aws-sdk/client-s3';
import { withMediaSnapshot, uploadMedia } from '../scripts/media.mjs';
import { createTestProject } from './helpers/project.mjs';

const media = fileURLToPath(new URL('./fixtures/media/', import.meta.url));
const env = {
  R2_ACCOUNT_ID: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  R2_BUCKET: 'test',
  MEDIA_PUBLIC_URL: 'https://media.example.org/archive',
};

test('the object key, size and uploaded body describe the same private snapshot', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'linsto-upload-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'notes.pdf');
  const original = Buffer.from('original');
  await writeFile(file, original);
  const key =
    'application/' +
    createHash('sha256').update(original).digest('hex') +
    '.pdf';
  const send = t.mock.method(
    S3Client.prototype,
    'send',
    async (command: PutObjectCommand) => {
      const { Body, ContentLength, Key, ContentType } = command.input;
      const uploaded =
        Body instanceof Uint8Array
          ? Buffer.from(Body)
          : await buffer(Body as Readable);
      assert.deepEqual(uploaded, original);
      assert.equal(ContentLength, uploaded.length);
      assert.equal(ContentType, 'application/pdf');
      assert.equal(Key, key);
      return { ETag: '"test"', $metadata: { httpStatusCode: 200 } };
    },
  );
  let snapshot = '';
  await withMediaSnapshot(file, async (info) => {
    snapshot = info.snapshot;
    await writeFile(file, 'modified');
    assert.equal(
      await uploadMedia(info, env),
      env.MEDIA_PUBLIC_URL + '/' + key,
    );
  });
  assert.equal(send.mock.callCount(), 1);
  await assert.rejects(stat(snapshot), { code: 'ENOENT' });
  assert.equal(await readFile(file, 'utf8'), 'modified');
});

test('public URL credentials are rejected before sending any bytes and snapshots are cleaned up on failure', async (t) => {
  const send = t.mock.method(S3Client.prototype, 'send', () => {
    throw new Error('unexpected upload');
  });
  for (const userinfo of ['author', ':secret', 'author:secret']) {
    let snapshot = '';
    await assert.rejects(
      withMediaSnapshot(path.join(media, 'audio.webm'), async (info) => {
        snapshot = info.snapshot;
        await uploadMedia(info, {
          ...env,
          MEDIA_PUBLIC_URL: 'https://' + userinfo + '@media.example.org',
        });
      }),
      /MEDIA_PUBLIC_URL.*认证/,
    );
    await assert.rejects(stat(snapshot), { code: 'ENOENT' });
  }
  assert.equal(send.mock.callCount(), 0);
});

test('media and audio CLI dry-runs classify the same WebM through their public entry points', async (t) => {
  const project = await createTestProject();
  t.after(project.dispose);
  for (const [name, mime, duration] of [
    ['audio', 'audio/webm', 0.128],
    ['mixed', 'video/webm', 0.148],
    ['video', 'video/webm', undefined],
  ] as const) {
    await t.test(name, async () => {
      const file = path.join(media, name + '.webm');
      const bytes = await readFile(file);
      const key =
        mime.split('/')[0] +
        '/' +
        createHash('sha256').update(bytes).digest('hex') +
        '.webm';
      const args = ['--dry-run', '--file', file];
      assert.deepEqual(JSON.parse(project.cli('media', ...args)), {
        key,
        bytes: bytes.length,
        mime,
      });
      const audio = () =>
        project.cli(
          'audio',
          ...args,
          '--slug',
          name,
          '--title',
          '试听',
          '--description',
          '音轨测试',
        );
      if (duration === undefined) {
        assert.throws(audio, { status: 1, stderr: /音轨/ });
      } else {
        const result = JSON.parse(audio());
        assert.equal(result.key, key);
        assert.equal(result.bytes, bytes.length);
        assert.equal(result.mime, mime);
        assert.equal(result.duration, duration);
      }
      await assert.rejects(
        stat(project.content('audio/' + name + '/index.md')),
        { code: 'ENOENT' },
      );
    });
  }
});
