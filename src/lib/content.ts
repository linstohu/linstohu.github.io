import { getCollection, type CollectionEntry } from 'astro:content';
export type Writing = CollectionEntry<'writing'>;
export type Audio = CollectionEntry<'audio'>;
export type Snapshot = CollectionEntry<'now'>;

import { isPublished, validateContentGraph } from './publication';
import { articleExcerpt } from './excerpt';
import { site } from './site';
const buildTime = Date.now();
const visible = (entry: Writing | Audio | Snapshot) =>
  import.meta.env.DEV || isPublished(entry.data, buildTime);
const latestFirst = (
  a: Writing | Audio | Snapshot,
  b: Writing | Audio | Snapshot,
) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
async function readContent() {
  const [writing, audio, now, series] = await Promise.all([
    getCollection('writing'),
    getCollection('audio'),
    getCollection('now'),
    getCollection('series'),
  ]);
  const posts = writing.filter(visible).sort(latestFirst);
  const sounds = audio.filter(visible).sort(latestFirst);
  const snapshots = now
    .filter(visible)
    .sort((a, b) => b.data.period.localeCompare(a.data.period));
  validateContentGraph({ writing, audio, now, series });
  return { posts, sounds, snapshots, series };
}
let productionContent: ReturnType<typeof readContent> | undefined;
export function loadContent() {
  return import.meta.env.DEV
    ? readContent()
    : (productionContent ??= readContent());
}
export function address(entry: Writing | Audio | Snapshot): string {
  if (entry.collection === 'now')
    return `/now/${entry.data.period.replace('-', '/')}/`;
  return `/${entry.collection}/${entry.data.slug}/`;
}
export function entryKey(entry: Writing | Audio | Snapshot): string {
  const id = entry.collection === 'now' ? entry.data.period : entry.data.slug;
  return `${entry.collection}:${id}`;
}
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function dateLabel(date: Date): string {
  return dateFormat.format(date).replaceAll('-', '.');
}
export function audioLabel(
  entry: Audio,
  series: CollectionEntry<'series'>[],
): string {
  const show = series.find((item) => item.id === entry.data.series);
  return show
    ? show.data.title +
        (entry.data.episode ? ` · EP.${entry.data.episode}` : '')
    : '声音手记';
}

export function collectionTags(
  entry: Writing | Audio | Snapshot,
  archive = false,
): string[] {
  if (archive)
    return [{ writing: '文字', audio: '声音', now: '此刻' }[entry.collection]];
  if (entry.collection === 'writing')
    return [
      ...(entry.data.category ? [entry.data.category] : []),
      ...entry.data.tags,
    ];
  if (entry.collection === 'audio')
    return [entry.data.series ?? 'kind:recording'];
  return ['此刻'];
}

export function entryDescription(entry: Writing | Audio | Snapshot): string {
  return entry.collection === 'now'
    ? articleExcerpt(entry.rendered?.html ?? '', '')
    : entry.data.description;
}

export function searchMetadata(
  entry: Writing | Audio | Snapshot,
  showTitle?: string,
) {
  const fields = [
    site.author,
    entryDescription(entry),
    ...collectionTags(entry),
  ];
  if (entry.collection === 'writing' && entry.data.conversation) {
    fields.push(
      entry.data.conversation.assistant,
      entry.data.conversation.model ?? '',
    );
  } else if (entry.collection === 'audio') {
    fields.push(
      showTitle ?? '声音手记 独立录音',
      entry.data.episode ? 'EP.' + entry.data.episode : '',
    );
  } else if (entry.collection === 'now') {
    fields.push(entry.data.period, '月份快照');
  }
  return fields.filter(Boolean).join(' ');
}
