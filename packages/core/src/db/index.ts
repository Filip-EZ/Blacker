import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { envValue } from '../env';
import * as schema from './schema';

export { schema };

/**
 * Pulls the bare postgres URL out of whatever got pasted: a whole `DATABASE_URL="..."` line,
 * Neon's `psql '...'` snippet, or the URL itself.
 */
export function extractDbUrl(raw: string): string {
  const url = raw.match(/postgres(?:ql)?:\/\/[^\s'"`]+/)?.[0];
  if (url) return url;
  // Describe the shape only, never the value: it holds the password.
  const shape = `długość ${raw.length}, początek "${raw.slice(0, 4).replace(/[A-Za-z0-9]/g, '*')}…"`;
  throw new Error(`DATABASE_URL nie zawiera adresu postgresql://… (${shape}). Wklej connection string z Neon.`);
}

export function createDb(url = envValue('DATABASE_URL')) {
  if (!url) throw new Error('DATABASE_URL nie jest ustawiony (connection string z Neon).');
  return drizzle(neon(extractDbUrl(url)), { schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
