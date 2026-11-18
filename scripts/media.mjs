import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { parseFile, TrackType } from 'music-metadata';
import { required, reportError } from './lib.mjs';
const types = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};
async function mediaFormat(file, extension, forAudio) {
  let mime = types[extension];
  const webm = extension === '.webm';
  if (!forAudio && !webm) return { mime };
  if (!webm && !mime.startsWith('audio/'))
    throw new Error('请提供 MP3、M4A、OGG、OPUS、WAV、FLAC 或 WEBM 音频。');
  const { format } = await parseFile(file, {
    duration: forAudio,
    skipCovers: true,
  });
  if (webm) {
    const tracks = format.trackInfo;
    const hasAudio = tracks.some(
      (track) => track.type === TrackType.audio && track.flagEnabled !== false,
    );
    const hasVideo = tracks.some((track) => track.type === TrackType.video);
    if (!hasAudio && (forAudio || !hasVideo))
      throw new Error('WebM 文件中没有可用音轨。');
    mime = hasVideo ? 'video/webm' : 'audio/webm';
  }
  if (forAudio && (!Number.isFinite(format.duration) || format.duration <= 0))
    throw new Error('无法读取音频时长，请先检查源文件。');
  return { mime, duration: format.duration };
}

/** @typedef {{ snapshot: string, key: string, bytes: number, mime: string, duration?: number }} MediaSnapshot */
/**
 * The snapshot is available until the callback settles.
 * @template T
 * @param {string} file
 * @param {(info: MediaSnapshot) => T} operation
 * @param {{forAudio?: boolean}} [options]
 * @returns {Promise<Awaited<T>>}
 */
export async function withMediaSnapshot(
  file,
  operation,
  { forAudio = false } = {},
) {
  const source = path.resolve(required(file, '--file 本地文件路径'));
  const extension = path.extname(source).toLowerCase();
  if (!Object.hasOwn(types, extension))
    throw new Error('暂不支持这个文件格式。请使用常见图片、音频、视频或 PDF。');
  if (!(await stat(source)).isFile()) throw new Error('请选择非空文件。');
  const directory = await mkdtemp(path.join(tmpdir(), 'linsto-media-'));
  try {
    const snapshot = path.join(directory, 'upload' + extension);
    await copyFile(source, snapshot, constants.COPYFILE_FICLONE);
    const { size: bytes } = await stat(snapshot);
    if (!bytes) throw new Error('请选择非空文件。');
    const { mime, duration } = await mediaFormat(snapshot, extension, forAudio);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(snapshot)) hash.update(chunk);
    const key = `${mime.split('/')[0]}/${hash.digest('hex')}${extension}`;
    return await operation({ snapshot, bytes, mime, key, duration });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export async function uploadMedia(info, env = process.env) {
  for (const name of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'MEDIA_PUBLIC_URL',
  ])
    required(env[name], `.env 中的 ${name}`);
  const base = new URL(env.MEDIA_PUBLIC_URL);
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error(
      'MEDIA_PUBLIC_URL 应为不含认证信息、查询参数或片段的 HTTPS 公共地址。',
    );
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  const body = createReadStream(info.snapshot);
  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: env.R2_BUCKET,
        Key: info.key,
        Body: body,
        ContentType: info.mime,
        ContentLength: info.bytes,
        CacheControl: 'public,max-age=31536000,immutable',
      },
      queueSize: 3,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    });
    await upload.done();
  } finally {
    body.destroy();
    client.destroy();
  }
  return new URL(info.key, base.href.replace(/\/?$/, '/')).href;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help)
    console.log(
      'pnpm run media --file "/path/to/photo.jpg" [--dry-run]\n上传到 R2 后返回可写入 Markdown 的公共链接；--dry-run 仅检查文件。',
    );
  else
    try {
      await withMediaSnapshot(values.file, async (info) => {
        if (values['dry-run']) {
          const { key, bytes, mime } = info;
          console.log(JSON.stringify({ key, bytes, mime }, null, 2));
          return;
        }
        const url = await uploadMedia(info);
        console.log(
          info.mime.startsWith('image/') ? `![图片说明](${url})` : url,
        );
      });
    } catch (error) {
      reportError(error);
    }
}
