/**
 * @file Drops every table in the local database and migrates it again. Callers must have passed
 *   the local-only guard in `reset-command.ts`; this file does no checking of its own.
 * @module @caa/db/seed/reset-database
 * @requirement NFR-05
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Database } from '../client';

/**
 * Drops the application and migration-journal schemas, recreates `public`, and applies every
 * migration.
 *
 * @param db - Handle on the database to wipe. The caller has already confirmed it is local.
 * @throws {Error} When a statement or migration fails; the database may be left empty.
 */
export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)),
  });
}
