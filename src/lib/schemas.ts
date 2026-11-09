import { z } from 'astro/zod';

const text = z.string().trim().min(1);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const timestampSchema = z.iso
  .datetime({
    offset: true,
    error: '请使用带时区的日期字符串，例如 2026-11-09T18:30:00+08:00',
  })
  .transform((value) => new Date(value));
const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), '请使用 HTTP 或 HTTPS 地址');
const resource = text.refine(
  (value) =>
    (value.startsWith('/') && !value.startsWith('//')) ||
    /^https:\/\//.test(value),
  '资源应使用站内绝对路径或 HTTPS 地址',
);
const common = {
  title: text,
  publishedAt: timestampSchema,
  draft: z.boolean().default(true),
  sample: z.boolean().default(false),
};
export const writingSchema = z.object({
  ...common,
  slug: slugSchema,
  description: text,
  category: text,
  tags: z.array(text).default([]),
  updatedAt: timestampSchema.optional(),
  featuredExcerpt: text.optional(),
  excerptTitle: text.optional(),
  videos: z
    .array(
      z.object({
        title: text,
        url: httpUrl,
        creator: text,
        description: text.optional(),
      }),
    )
    .default([]),
  appendix: z.object({ title: text, notes: z.array(text).min(1) }).optional(),
});
export const audioSchema = z
  .object({
    ...common,
    slug: slugSchema,
    uid: text,
    description: text,
    kind: z.enum(['podcast', 'recording']),
    series: slugSchema.optional(),
    episode: text.optional(),
    duration: z.number().positive(),
    category: text,
    src: httpUrl.optional(),
    bytes: z.number().int().positive().optional(),
    mime: z
      .enum([
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
        'audio/flac',
        'audio/webm',
        'audio/aac',
      ])
      .optional(),
    relatedWriting: z.array(slugSchema).default([]),
    chapters: z
      .array(z.object({ time: z.number().nonnegative(), title: text }))
      .default([]),
  })
  .superRefine((entry, ctx) => {
    if (!entry.sample && !entry.draft) {
      for (const key of ['src', 'bytes', 'mime'] as const) {
        if (!entry[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: '正式声音需要音频地址、字节数和 MIME 类型，请先上传音频',
          });
      }
    }
    if (entry.kind === 'podcast' && !entry.series)
      ctx.addIssue({
        code: 'custom',
        path: ['series'],
        message: '播客需要关联节目',
      });
    let previous = -1;
    entry.chapters.forEach((chapter, index) => {
      if (chapter.time <= previous || chapter.time >= entry.duration)
        ctx.addIssue({
          code: 'custom',
          path: ['chapters', index, 'time'],
          message: '章节时间必须递增，且小于音频总时长',
        });
      previous = chapter.time;
    });
  });
export const nowSchema = z.object({
  ...common,
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  notes: z.array(z.object({ title: text, text })).min(1),
});
export const seriesSchema = z.object({
  title: text,
  description: text,
  coverTitle: z.array(text).min(1).optional(),
});
export const aboutSchema = z.object({
  title: text,
  greeting: text,
  description: text,
  sample: z.boolean().default(false),
  intro: z.array(text).min(1),
  image: resource,
});
export const siteSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  }, '站点地址应为 HTTPS 根域名'),
  title: text,
  author: text,
  greeting: text,
  name: text,
  description: text,
  sampleMode: z.boolean(),
  homeImage: resource,
  footerCredit: text,
});
export const classicsSchema = z
  .object({
    quotes: z
      .array(
        z.object({ id: text, text, author: text, work: text, url: httpUrl }),
      )
      .min(1),
  })
  .superRefine(({ quotes }, ctx) => {
    if (new Set(quotes.map((quote) => quote.id)).size !== quotes.length)
      ctx.addIssue({
        code: 'custom',
        path: ['quotes'],
        message: '经典摘句的 id 不可重复',
      });
  });
export const editorialSchemas = {
  writing: writingSchema,
  audio: audioSchema,
  now: nowSchema,
};
