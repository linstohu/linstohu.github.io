import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { audioSchema } from '../src/lib/schemas.ts';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  root,
  slug,
  required,
  timestamp,
  publishDocument,
  createDocument,
  reportError,
} from './lib.mjs';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string' },
    period: { type: 'string' },
    date: { type: 'string' },
    help: { type: 'boolean' },
    series: { type: 'string' },
    platform: { type: 'string' },
    'listen-url': { type: 'string' },
    episode: { type: 'string' },
  },
});
const [command, kind, name] = positionals;
if (values.help || !command) {
  console.log(`新建文字：pnpm run new writing my-essay --title "文章标题" --category "技术"
新建外部栏目单集：pnpm run new audio episode-one --title "第一期" --series thirty-plus --platform "小宇宙" --listen-url "单集网页地址"
新建此刻：pnpm run new now --period 2026-11 --title "十一月，慢一点"
新建节目：pnpm run new series my-show --title "节目名称"
发布内容：pnpm run publish:content writing/my-essay/index.md
         pnpm run publish:content now/2026-11.md
默认保留草稿；首次发布设为当前时间，再次发布保留首次日期，可用 --date 显式指定。
上传声音：pnpm run audio --help`);
} else {
  try {
    if (command === 'new') {
      const title = required(values.title, '--title "标题"');
      if (kind === 'writing') {
        const id = slug(name);
        const file = path.join(root, 'content/writing', id, 'index.md');
        await createDocument(
          file,
          {
            slug: id,
            title,
            description: values.description || '请写一句内容摘要。',
            publishedAt: timestamp(),
            draft: true,
            ...(values.category && { category: values.category }),
            tags: [],
          },
          '## 从这里落笔\n\n正文支持 Markdown、图片、代码与链接。',
        );
        console.log(`已新建草稿：${path.relative(root, file)}`);
      } else if (kind === 'audio') {
        const id = slug(name);
        const series = slug(required(values.series, '--series 栏目标识'));
        await readFile(
          path.join(root, 'content/series', series + '.json'),
          'utf8',
        );
        const data = {
          slug: id,
          uid: randomUUID(),
          title,
          description: values.description || '请写一句单集介绍。',
          kind: 'podcast',
          series,
          ...(values.episode ? { episode: values.episode } : {}),
          listen: [
            {
              platform: required(values.platform, '--platform 平台名称'),
              url: required(values['listen-url'], '--listen-url 单集网页地址'),
            },
          ],
          publishedAt: timestamp(),
          draft: true,
        };
        audioSchema.parse(data);
        const file = path.join(root, 'content/audio', id, 'index.md');
        await createDocument(file, data, '');
        console.log(`已新建单集草稿：${path.relative(root, file)}`);
      } else if (kind === 'now') {
        const period = values.period || timestamp().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
          throw new Error('月份格式应为 YYYY-MM。');
        const file = path.join(root, 'content/now', period + '.md');
        await createDocument(
          file,
          {
            period,
            title,
            publishedAt: timestamp(),
            draft: true,
            notes: [
              { title: '正在做', text: '写下这段时间关注的一件事。' },
              {
                title: '正在读',
                text: '留一本书、一句话，或一个还在想的问题。',
              },
            ],
          },
          '',
        );
        console.log(`已新建草稿：${path.relative(root, file)}`);
      } else if (kind === 'series') {
        const id = slug(name);
        const file = path.join(root, 'content/series', id + '.json');
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(
          file,
          JSON.stringify(
            {
              title,
              description: values.description || '一句话介绍这档节目。',
              coverTitle: [title],
            },
            null,
            2,
          ) + '\n',
          { flag: 'wx' },
        );
        console.log(`已新建节目：${path.relative(root, file)}`);
      } else throw new Error('内容类型请选择 writing、audio、now 或 series。');
    } else if (command === 'publish') {
      const relative = required(kind, 'content 下的文件路径');
      if (
        !/^(writing|audio)\/[a-z0-9-]+\/index\.md$|^now\/\d{4}-\d{2}\.md$/.test(
          relative,
        )
      )
        throw new Error(
          '路径示例：writing/my-essay/index.md 或 now/2026-11.md',
        );
      const file = path.join(root, 'content', relative);
      const date = await publishDocument(
        file,
        relative.split('/')[0],
        values.date,
      );
      console.log(
        `已设为发布：content/${relative}\n发布时间：${date}\n提交推送前请运行 pnpm run validate。`,
      );
    } else throw new Error('不支持的操作。请使用 --help 查看用法。');
  } catch (error) {
    reportError(error);
  }
}
