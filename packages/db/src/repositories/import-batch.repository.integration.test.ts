/**
 * @file Integration tests for the import batch repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildBatch,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createImportBatchRepository } from './import-batch.repository';
import { createRosterRepository } from './roster.repository';

describe('ImportBatchRepository', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('finds a recorded batch by tenant, source, and batch ID', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const batch = buildBatch(tenantId);
    await createRosterRepository(db).publishRoster(tenantId, { batch, rows: [], quarantined: [] });

    const found = await createImportBatchRepository(db).findByKey(
      tenantId,
      'demo-sis',
      'batch-0001',
    );

    expect(found).toEqual(batch);
  });

  it("does not find another tenant's batch", async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const otherTenantId = await insertTenant(db);
    await createRosterRepository(db).publishRoster(tenantId, {
      batch: buildBatch(tenantId),
      rows: [],
      quarantined: [],
    });

    const found = await createImportBatchRepository(db).findByKey(
      otherTenantId,
      'demo-sis',
      'batch-0001',
    );

    expect(found).toBeNull();
  });

  it('returns the newest published effective time and ignores quarantined batches', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const roster = createRosterRepository(db);
    const publish = (batchId: string, sourceEffectiveAt: string) =>
      roster.publishRoster(tenantId, {
        batch: buildBatch(tenantId, { batchId, sourceEffectiveAt }),
        rows: [],
        quarantined: [],
      });
    await publish('b2', '2026-09-24T06:00:00.000Z');
    await publish('b1', '2026-09-22T06:00:00.000Z');
    await roster.quarantineRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b3', sourceEffectiveAt: '2026-09-30T06:00:00.000Z' }),
      quarantined: [],
    });

    const latest = await createImportBatchRepository(db).findLatestPublishedEffectiveAt(
      tenantId,
      'demo-sis',
    );

    expect(latest).toBe('2026-09-24T06:00:00.000Z');
  });

  it('returns null when nothing from the source was published', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);

    const latest = await createImportBatchRepository(db).findLatestPublishedEffectiveAt(
      tenantId,
      'demo-sis',
    );

    expect(latest).toBeNull();
  });
});
