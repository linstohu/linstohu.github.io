import type { APIRoute } from 'astro';
import { loadContent, address, durationLabel } from '../../lib/content';
import { site as settings } from '../../lib/site';
import { xml, xmlResponse } from '../../lib/feeds';
export const GET: APIRoute = async ({ site }) => {
  const { sounds } = await loadContent();
  const entries = sounds.filter(
    (entry) => entry.data.src && entry.data.bytes && entry.data.mime,
  );
  const base = site || new URL('https://linsto.org');
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${xml(settings.title)} · 声音</title><link>${new URL('/audio/', base)}</link><description>${xml(settings.audioSubtitle || settings.title + ' · 声音')}</description><language>zh-CN</language><itunes:author>${xml(settings.author)}</itunes:author><itunes:explicit>false</itunes:explicit><atom:link href="${new URL('/audio/rss.xml', base)}" rel="self" type="application/rss+xml"/>${entries.map((entry) => `<item><title>${xml(entry.data.title)}</title><link>${new URL(address(entry), base)}</link><guid isPermaLink="false">${xml(entry.data.uid)}</guid><pubDate>${entry.data.publishedAt.toUTCString()}</pubDate><description>${xml(entry.data.description)}</description><enclosure url="${xml(entry.data.src)}" length="${entry.data.bytes}" type="${xml(entry.data.mime)}"/><itunes:duration>${durationLabel(entry.data.duration)}</itunes:duration></item>`).join('')}</channel></rss>`);
};
