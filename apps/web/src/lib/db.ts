import { createDb, type Db } from '@blacker/core/db';

let db: Db | undefined;

/** One Neon HTTP client per server instance, created on first use so builds work without DATABASE_URL. */
export function getDb(): Db {
  return (db ??= createDb());
}
