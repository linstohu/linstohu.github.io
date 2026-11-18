interface Publication {
  draft: boolean;
  publishedAt: Date;
}
const writingDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function writingDirectory(slug: string, publishedAt: Date): string {
  return `${writingDay.format(publishedAt)}-${slug}`;
}
export function isPublished(
  data: Publication,
  asOf: number = Date.now(),
): boolean {
  return !data.draft && data.publishedAt.getTime() <= asOf;
}
interface WritingReference {
  id: string;
  data: { slug: string; publishedAt: Date };
}
interface AudioReference {
  data: {
    slug: string;
    uid: string;
    series?: string;
    relatedWriting: string[];
  };
}
export function validateSnapshotContent(
  notes: readonly unknown[],
  body?: string,
) {
  if (!notes.length && !body?.trim())
    throw new Error('发布快照需要填写 Markdown 正文或 notes。');
}
interface SnapshotReference {
  id: string;
  body?: string;
  data: { period: string; draft: boolean; notes: unknown[] };
}
interface ContentGraph {
  writing: WritingReference[];
  audio: AudioReference[];
  now: SnapshotReference[];
  series: { id: string }[];
}
function unique(values: string[], label: string) {
  const found = new Set<string>();
  for (const value of values) {
    if (found.has(value)) throw new Error(`${label}：${value}`);
    found.add(value);
  }
  return found;
}
export function validateContentGraph({
  writing,
  audio,
  now,
  series,
}: ContentGraph) {
  const posts = unique(
    writing.map((entry) => entry.data.slug),
    '重复的文字地址',
  );
  unique(
    audio.map((entry) => entry.data.slug),
    '重复的声音地址',
  );
  unique(
    audio.map((entry) => entry.data.uid),
    '重复的声音订阅标识',
  );
  unique(
    now.map((entry) => entry.data.period),
    '重复的快照月份',
  );
  for (const entry of writing) {
    const expected = writingDirectory(entry.data.slug, entry.data.publishedAt);
    if (entry.id !== expected)
      throw new Error(
        `文章目录与发布日期或 slug 不符：${entry.id}，应为 ${expected}`,
      );
  }
  const shows = new Set(series.map((entry) => entry.id));
  for (const entry of now) {
    if (entry.id !== entry.data.period)
      throw new Error(
        `快照文件名与 period 不符：${entry.id} / ${entry.data.period}`,
      );
    if (!entry.data.draft)
      validateSnapshotContent(entry.data.notes, entry.body);
  }
  for (const entry of audio) {
    if (entry.data.series && !shows.has(entry.data.series))
      throw new Error(
        `声音 ${entry.data.slug} 引用了不存在的节目 ${entry.data.series}`,
      );
    for (const related of entry.data.relatedWriting)
      if (!posts.has(related))
        throw new Error(
          `声音 ${entry.data.slug} 引用了不存在的文章 ${related}`,
        );
  }
}
