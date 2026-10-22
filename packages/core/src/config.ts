import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { adapters } from './adapters';
import type { SourceConfig } from './types';

const Source = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  adapter: z.enum(Object.keys(adapters) as [string, ...string[]]),
  tier: z.enum(['aggregator', 'big', 'small']),
  enabled: z.boolean().default(true),
  url: z.url().optional(),
  urls: z.array(z.url()).optional(),
  category: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const Config = z.object({
  settings: z.object({
    minScoreToStore: z.number().default(35),
    aiThreshold: z.number().default(60),
    aiDailyLimit: z.number().int().default(300),
    aiBatchSize: z.number().int().min(1).max(50).default(20),
    requestDelayMs: z.number().int().default(3000),
  }),
  sources: z.array(Source).refine((s) => new Set(s.map((x) => x.id)).size === s.length, 'id źródeł muszą być unikalne'),
});

export type Settings = z.infer<typeof Config>['settings'];

export function loadConfig(path: string): { settings: Settings; sources: SourceConfig[] } {
  return Config.parse(parse(readFileSync(path, 'utf8')));
}
