import type { APIRoute } from 'astro';
import { loadContent, address } from '../lib/content';
import { xml, xmlResponse } from '../lib/feeds';
import { site as settings } from '../lib/site';
export const GET: APIRoute = async ({ site }) => {
  const { posts, sounds, snapshots } = await loadContent();
  const base = site || new URL(settings.url);
  const urls = [
    '/',
    '/writing/',
    '/audio/',
    '/now/',
    '/now/archive/',
    '/about/',
    '/archive/',
    ...[...posts, ...sounds, ...snapshots].map(address),
  ];
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${xml(new URL(url, base))}</loc></url>`).join('')}</urlset>`,
  );
};
