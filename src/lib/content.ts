import { getCollection, type CollectionEntry } from 'astro:content';
export type Writing = CollectionEntry<'writing'>;
export type Audio = CollectionEntry<'audio'>;
export type Snapshot = CollectionEntry<'now'>;

import { isPublished, validateContentGraph } from './publication';
const buildTime = Date.now();
const visible = (entry: Writing | Audio | Snapshot) =>
  import.meta.env.DEV || isPublished(entry.data, buildTime);
const latestFirst = (
  a: Writing | Audio | Snapshot,
  b: Writing | Audio | Snapshot,
) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
export async function loadContent() {
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
export function address(entry: Writing | Audio | Snapshot): string {
  if (entry.collection === 'now')
    return `/now/${entry.data.period.replace('-', '/')}/`;
  return `/${entry.collection}/${entry.data.slug}/`;
}
export function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '.');
}
export function durationLabel(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
export function audioLabel(
  entry: Audio,
  series: CollectionEntry<'series'>[],
): string {
  const show = series.find((item) => item.id === entry.data.series);
  return show
    ? show.data.title +
        (entry.data.episode ? ` · EP.${entry.data.episode}` : '')
    : '独立录音';
}
