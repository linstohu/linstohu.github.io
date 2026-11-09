import raw from '../../content/quotes/collection.json';
import { classicsSchema } from './schemas';
export const { quotes } = classicsSchema.parse(raw);
