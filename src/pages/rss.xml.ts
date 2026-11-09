import type { APIRoute } from 'astro';
import { loadContent, address } from '../lib/content';
import { xml, xmlResponse } from '../lib/feeds';
import { site as settings } from '../lib/site';
export const GET: APIRoute = async ({ site }) => {
  const { posts } = await loadContent();
  const base = site || new URL(settings.url);
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(settings.title)} · 文字</title><link>${base}</link><description>${xml(settings.description)}</description><language>zh-CN</language><atom:link href="${new URL('/rss.xml', base)}" rel="self" type="application/rss+xml"/>${posts.map((entry) => `<item><title>${xml(entry.data.title)}</title><link>${new URL(address(entry), base)}</link><guid>${new URL(address(entry), base)}</guid><pubDate>${entry.data.publishedAt.toUTCString()}</pubDate><description>${xml(entry.data.description)}</description>${entry.data.category ? `<category>${xml(entry.data.category)}</category>` : ''}</item>`).join('')}</channel></rss>`);
};
