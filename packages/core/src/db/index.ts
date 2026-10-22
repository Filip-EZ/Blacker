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
  if (url && isValidUrl(url)) return url;
  throw new Error(`DATABASE_URL nie jest poprawnym adresem postgresql://user:hasło@host/baza (układ: ${shape(raw)}). Wklej connection string z Neon.`);
}

// Same check as neon(): the URL must parse both as is and with an http: scheme.
function isValidUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    new URL(`http:${url.slice(protocol.length)}`);
    return true;
  } catch {
    return false;
  }
}

/** Layout of a secret with letters and digits masked, so a broken paste can be diagnosed from public CI logs. */
function shape(raw: string) {
  return `długość ${raw.length}, "${raw.replace(/[\p{L}\p{N}]/gu, '*').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}

export function createDb(url = envValue('DATABASE_URL')) {
  if (!url) throw new Error('DATABASE_URL nie jest ustawiony (connection string z Neon).');
  return drizzle(neon(extractDbUrl(url)), { schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
