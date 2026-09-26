/**
 * @file Creates the typed database client.
 * @module @caa/db/client
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';

/** Typed database handle passed into repositories. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Opens a connection pool and wraps it in the typed client.
 *
 * @param connectionString - PostgreSQL connection URL.
 * @returns The typed database handle.
 */
export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString });
  return drizzle({ client: pool, schema });
}
