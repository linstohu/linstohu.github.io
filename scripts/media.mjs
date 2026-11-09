import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
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
export async function describeMedia(file) {
  const absolute = path.resolve(required(file, '--file 本地文件路径'));
  const info = await stat(absolute);
  if (!info.isFile() || info.size === 0) throw new Error('请选择非空文件。');
  const extension = path.extname(absolute).toLowerCase();
  const mime = types[extension];
  if (!mime)
    throw new Error('暂不支持这个文件格式。请使用常见图片、音频、视频或 PDF。');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(absolute)) hash.update(chunk);
  const key = `${mime.split('/')[0]}/${hash.digest('hex')}${extension}`;
  return { absolute, bytes: info.size, mime, key };
}
export async function uploadMedia(info) {
  const env = process.env;
  for (const name of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'MEDIA_PUBLIC_URL',
  ])
    required(env[name], `.env 中的 ${name}`);
  const base = new URL(env.MEDIA_PUBLIC_URL);
  if (base.protocol !== 'https:' || base.search || base.hash)
    throw new Error('MEDIA_PUBLIC_URL 应为无查询参数的 HTTPS 公共地址。');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  const upload = new Upload({
    client,
    params: {
      Bucket: env.R2_BUCKET,
      Key: info.key,
      Body: createReadStream(info.absolute),
      ContentType: info.mime,
      ContentLength: info.bytes,
      CacheControl: 'public,max-age=31536000,immutable',
    },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  });
  try {
    await upload.done();
  } finally {
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
      const info = await describeMedia(values.file);
      if (values['dry-run'])
        console.log(
          JSON.stringify(
            { key: info.key, bytes: info.bytes, mime: info.mime },
            null,
            2,
          ),
        );
      else {
        const url = await uploadMedia(info);
        console.log(
          info.mime.startsWith('image/') ? `![图片说明](${url})` : url,
        );
      }
    } catch (error) {
      reportError(error);
    }
}
