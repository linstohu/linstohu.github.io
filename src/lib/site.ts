import raw from '../../content/settings/site.json' with { type: 'json' };
import { siteSchema } from './schemas.ts';
const settings = siteSchema.parse(raw);
export const site = { ...settings, domain: new URL(settings.url).hostname };
