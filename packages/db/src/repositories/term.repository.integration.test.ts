/**
 * @file Integration tests for the term repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertTerm, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createTermRepository } from './term.repository';

describe('TermRepository.findOrdered', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('orders terms by sequence, not by term code or insertion order', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    await insertTerm(db, tenantId, { termCode: '2026SU', sequence: 20262 });
    await insertTerm(db, tenantId, { termCode: '2026FA', sequence: 20263 });
    await insertTerm(db, tenantId, { termCode: '2026SP', sequence: 20261 });

    const calendar = await createTermRepository(db).findOrdered(tenantId);

    expect(calendar.map((term) => term.termCode)).toEqual(['2026SP', '2026SU', '2026FA']);
  });

  it('round-trips the term dates as calendar date strings', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const termId = await insertTerm(db, tenantId, {
      termCode: '2026FA',
      sequence: 3,
      startsOn: '2026-08-24',
      endsOn: '2026-12-18',
    });

    const calendar = await createTermRepository(db).findOrdered(tenantId);

    expect(calendar).toEqual([
      {
        id: termId,
        tenantId,
        termCode: '2026FA',
        startsOn: '2026-08-24',
        endsOn: '2026-12-18',
        sequence: 3,
      },
    ]);
  });

  it('returns an empty calendar when the tenant supplied no terms', async () => {
    const tenantId = await insertTenant(testDatabase.db);

    expect(await createTermRepository(testDatabase.db).findOrdered(tenantId)).toEqual([]);
  });

  it("does not return another tenant's terms", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    await insertTerm(db, tenantB, { termCode: '2026FA', sequence: 3 });

    expect(await createTermRepository(db).findOrdered(tenantA)).toEqual([]);
  });

  it('rejects a repeated term code within one tenant', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    await insertTerm(db, tenantId, { termCode: '2026FA', sequence: 3 });

    await expect(
      insertTerm(db, tenantId, { termCode: '2026FA', sequence: 4 }),
    ).rejects.toMatchObject(violationOf('term_tenant_id_term_code_key'));
  });

  it('rejects a repeated sequence within one tenant', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    await insertTerm(db, tenantId, { termCode: '2026FA', sequence: 3 });

    await expect(
      insertTerm(db, tenantId, { termCode: '2027SP', sequence: 3 }),
    ).rejects.toMatchObject(violationOf('term_tenant_id_sequence_key'));
  });

  it('allows the same term code and sequence in another tenant', async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    await insertTerm(db, tenantA, { termCode: '2026FA', sequence: 3 });

    await insertTerm(db, tenantB, { termCode: '2026FA', sequence: 3 });

    expect(await createTermRepository(db).findOrdered(tenantB)).toHaveLength(1);
  });

  it('refuses to store a term that ends before it starts', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);

    const insert = insertTerm(db, tenantId, {
      termCode: '2026FA',
      sequence: 3,
      startsOn: '2026-12-18',
      endsOn: '2026-08-24',
    });

    await expect(insert).rejects.toMatchObject(violationOf('term_date_range'));
  });
});
