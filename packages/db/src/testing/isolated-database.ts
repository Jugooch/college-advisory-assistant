/**
 * @file Creates a throwaway, migrated database for integration tests that publish records the
 *   shared per-run database must not see, such as a newer source revision. Test code only.
 * @module @caa/db/testing/isolated-database
 * @see docs/standards/07-testing.md
 */
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import * as schema from '../schema';
import type { TestDatabase } from './integration-fixtures';

/** Counts the databases this process has made, so names never repeat within a run. */
let created = 0;

/**
 * Creates a fresh database on the integration server, applies the migrations, and opens it.
 *
 * @returns The handle; `close` also drops the database.
 * @throws {Error} When DATABASE_URL is not set.
 */
export async function openIsolatedTestDatabase(): Promise<TestDatabase> {
  const serverUrl = process.env.DATABASE_URL;
  if (!serverUrl) {
    throw new Error('DATABASE_URL is not set; run these tests through the integration project');
  }
  created += 1;
  // SECURITY: digits and underscores only, so the name is safe to place in DDL.
  const name = `caa_test_iso_${String(Date.now())}_${String(process.pid)}_${String(created)}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString() });
  const db = drizzle({ client: pool, schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)),
  });
  return {
    db,
    close: async () => {
      await pool.end();
      const dropper = new pg.Client({ connectionString: serverUrl });
      await dropper.connect();
      try {
        await dropper.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      } finally {
        await dropper.end();
      }
    },
  };
}
