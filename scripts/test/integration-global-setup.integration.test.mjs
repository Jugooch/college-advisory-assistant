/**
 * @file Proves the integration setup: tests reach PostgreSQL through a fresh per-run database.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

describe('integration global setup', () => {
  /** @type {pg.Client} */
  let client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('points DATABASE_URL at the per-run test database', async () => {
    const result = await client.query('SELECT current_database() AS name');

    expect(result.rows[0].name).toMatch(/^caa_test_\d+_\d+$/);
    expect(process.env.DATABASE_URL).toBe(inject('integrationDatabaseUrl'));
  });

  it('runs against PostgreSQL 17', async () => {
    const result = await client.query('SHOW server_version_num');

    expect(Number(result.rows[0].server_version_num)).toBeGreaterThanOrEqual(170000);
  });
});
