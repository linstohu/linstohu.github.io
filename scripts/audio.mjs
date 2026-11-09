import { parseArgs } from 'node:util';
import { parseFile } from 'music-metadata';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { describeMedia, uploadMedia } from './media.mjs';
import {
  root,
  slug,
  required,
  timestamp,
  mustNotExist,
  createDocument,
  reportError,
} from './lib.mjs';
const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    kind: { type: 'string', default: 'recording' },
    series: { type: 'string' },
    episode: { type: 'string' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean' },
  },
});
if (values.help)
  console.log(`独立录音：pnpm run audio --file "/path/to/voice.m4a" --slug autumn --title "秋日手记" --description "一句话介绍"
播客单集：在以上参数后追加 --kind podcast --series old-enough --episode 42
本地检查：追加 --dry-run（不上传、不写文件）
上传成功后生成声音草稿，自动填写时长、大小、文件类型和公共地址。编辑文字稿后再运行 pnpm run publish:content。`);
else
  try {
    const id = slug(values.slug),
      title = required(values.title, '--title'),
      description = required(values.description, '--description');
    const kind = values.kind;
    if (!['podcast', 'recording'].includes(kind))
      throw new Error('--kind 应为 podcast 或 recording。');
    const target = path.join(root, 'content/audio', id, 'index.md');
    await mustNotExist(target);
    if (kind === 'podcast' && !values.series)
      throw new Error('播客请指定 --series 节目标识。');
    if (values.series) {
      const series = slug(values.series);
      await readFile(
        path.join(root, 'content/series', series + '.json'),
        'utf8',
      );
    }
    const info = await describeMedia(values.file);
    if (
      ![
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
        'audio/flac',
        'video/webm',
      ].includes(info.mime)
    )
      throw new Error('请提供 MP3、M4A、OGG、OPUS、WAV、FLAC 或 WEBM 音频。');
    const metadata = await parseFile(info.absolute, { duration: true });
    const duration = metadata.format.duration;
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error('无法读取音频时长，请先检查源文件。');
    const mime = info.mime === 'video/webm' ? 'audio/webm' : info.mime;
    if (values['dry-run'])
      console.log(
        JSON.stringify(
          {
            title,
            slug: id,
            kind,
            duration,
            bytes: info.bytes,
            mime,
            key: info.key,
          },
          null,
          2,
        ),
      );
    else {
      const src = await uploadMedia({ ...info, mime });
      console.log(`音频已上传：${src}`);
      await createDocument(
        target,
        {
          uid: randomUUID(),
          slug: id,
          title,
          description,
          kind,
          ...(values.series ? { series: values.series } : {}),
          ...(values.episode ? { episode: values.episode } : {}),
          publishedAt: timestamp(),
          draft: true,
          sample: false,
          category: kind === 'podcast' ? '播客' : '独立录音',
          duration: Math.round(duration * 1000) / 1000,
          src,
          bytes: info.bytes,
          mime,
          chapters: [],
        },
        '## 这一期\n\n写下声音介绍或文字稿。',
      );
      console.log(
        `音频已上传，草稿已生成：${path.relative(root, target)}\n检查正文后，再执行 pnpm run publish:content audio/${id}/index.md`,
      );
    }
  } catch (error) {
    reportError(error);
  }
