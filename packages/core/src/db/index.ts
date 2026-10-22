import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export { schema };

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL nie jest ustawiony (connection string z Neon).');
  return drizzle(neon(url), { schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
