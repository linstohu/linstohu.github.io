import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  writingSchema,
  audioSchema,
  nowSchema,
  seriesSchema,
  aboutSchema,
} from './lib/schemas';

export const collections = {
  writing: defineCollection({
    loader: glob({
      base: './content/writing',
      pattern: '**/index.md',
      generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
    }),
    schema: writingSchema,
  }),
  audio: defineCollection({
    loader: glob({
      base: './content/audio',
      pattern: '**/index.md',
      generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
    }),
    schema: audioSchema,
  }),
  now: defineCollection({
    loader: glob({ base: './content/now', pattern: '*.md' }),
    schema: nowSchema,
  }),
  series: defineCollection({
    loader: glob({ base: './content/series', pattern: '*.json' }),
    schema: seriesSchema,
  }),
  pages: defineCollection({
    loader: glob({ base: './content/pages', pattern: '*.md' }),
    schema: aboutSchema,
  }),
};
