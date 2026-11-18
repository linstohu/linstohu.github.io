import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { audioSchema } from '../src/lib/schemas.ts';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { withMediaSnapshot, uploadMedia } from './media.mjs';
import {
  root,
  slug,
  required,
  timestamp,
  withNewAudio,
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
播客单集：在以上参数后追加 --kind podcast --series my-show --episode 42
本地检查：追加 --dry-run（仅预览元数据）
上传成功后生成声音草稿，自动填写时长、大小、文件类型和公共地址。编辑文字稿后再运行 pnpm run publish:content。`);
else
  try {
    const id = slug(values.slug),
      title = required(values.title, '--title'),
      description = required(values.description, '--description');
    const kind = values.kind;
    const data = {
      uid: randomUUID(),
      slug: id,
      title,
      description,
      kind,
      ...(values.series ? { series: values.series } : {}),
      ...(values.episode ? { episode: values.episode } : {}),
      publishedAt: timestamp(),
      draft: true,
    };
    audioSchema.parse(data);
    if (values.series) {
      const series = slug(values.series);
      await readFile(
        path.join(root, 'content/series', series + '.json'),
        'utf8',
      );
    }
    const dryRun = values['dry-run'] ?? false;
    await withNewAudio(
      path.join(root, 'content/audio'),
      id,
      (target) =>
        withMediaSnapshot(
          values.file,
          async (info) => {
            const { duration, bytes, mime, key } = info;
            if (dryRun) {
              console.log(
                JSON.stringify(
                  { title, slug: id, kind, duration, bytes, mime, key },
                  null,
                  2,
                ),
              );
              return;
            }
            const src = await uploadMedia(info);
            console.log(`音频已上传：${src}`);
            await createDocument(
              target,
              {
                ...data,
                duration: Math.round(duration * 1000) / 1000 || duration,
                src,
                bytes,
                mime,
                chapters: [],
              },
              kind === 'podcast'
                ? '## 这一期\n\n写下单集笔记或文字稿。'
                : '写下这段录音的缘起或文字稿。',
            );
            console.log(
              `音频已上传，草稿已生成：${path.relative(root, target)}\n检查正文后，再执行 pnpm run publish:content audio/${id}/index.md`,
            );
          },
          { forAudio: true },
        ),
      { dryRun },
    );
  } catch (error) {
    reportError(error);
  }
