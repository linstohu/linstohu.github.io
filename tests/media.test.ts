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
import { audioSchema } from '../src/lib/schemas.ts';

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

test('both upload commands classify WebM by its tracks and agree on the key', async () => {
  for (const [name, mime] of [
    ['audio', 'audio/webm'],
    ['mixed', 'video/webm'],
    ['video', 'video/webm'],
  ]) {
    const file = path.join(media, name + '.webm');
    let expectedKey = '';
    await withMediaSnapshot(file, (info) => {
      assert.equal(info.mime, mime);
      assert.ok(info.key.startsWith(mime.split('/')[0] + '/'));
      expectedKey = info.key;
    });
    const inspect = () =>
      withMediaSnapshot(
        file,
        (info) => {
          assert.equal(info.mime, mime);
          assert.equal(info.key, expectedKey);
          assert.ok(typeof info.duration === 'number' && info.duration > 0);
          assert.equal(
            audioSchema.shape.mime.safeParse(info.mime).success,
            true,
          );
        },
        { forAudio: true },
      );
    if (name === 'video') await assert.rejects(inspect(), /音轨/);
    else await inspect();
  }
});
