/**
 * @file Integration tests for atomic roster publication against PostgreSQL.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRosterRow, ImportBatchStatus, type InstitutionId } from '@caa/domain';

import { importBatchTable } from '../tables/import-batch.table';
import { importQuarantineTable } from '../tables/import-quarantine.table';
import {
  buildBatch,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createImportBatchRepository } from './import-batch.repository';
import { createRosterRepository } from './roster.repository';
import { createStudentRepository } from './student.repository';

const active = (sourceStudentId: string) =>
  createRosterRow({ sourceStudentId, recordVersion: 1, isDeleted: false });
const tombstone = (sourceStudentId: string) =>
  createRosterRow({ sourceStudentId, recordVersion: 2, isDeleted: true });

describe('RosterRepository', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const repositories = () => ({
    roster: createRosterRepository(testDatabase.db),
    students: createStudentRepository(testDatabase.db),
    batches: createImportBatchRepository(testDatabase.db),
  });

  const readQuarantine = (tenantId: InstitutionId) =>
    testDatabase.db
      .select()
      .from(importQuarantineTable)
      .where(eq(importQuarantineTable.tenantId, tenantId));

  const readBatchRows = (tenantId: InstitutionId) =>
    testDatabase.db.select().from(importBatchTable).where(eq(importBatchTable.tenantId, tenantId));

  it('publishes the batch record, students, and quarantined rows together', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);

    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { recordCount: 3 }),
      rows: [active('SYN-0001'), active('SYN-0002')],
      quarantined: [{ rowIndex: 2, sourceRecordId: 'SYN-0003', reason: 'INVALID_RECORD_VERSION' }],
    });

    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).not.toBeNull();
    expect(await students.findBySourceStudentId(tenantId, 'SYN-0002')).not.toBeNull();
    const [batchRow] = await readBatchRows(tenantId);
    expect(batchRow?.status).toBe(ImportBatchStatus.Published);
    expect(batchRow?.rejectedCount).toBe(1);
    const quarantined = await readQuarantine(tenantId);
    expect(
      quarantined.map(({ rowIndex, sourceRecordId, reason }) => ({
        rowIndex,
        sourceRecordId,
        reason,
      })),
    ).toEqual([{ rowIndex: 2, sourceRecordId: 'SYN-0003', reason: 'INVALID_RECORD_VERSION' }]);
  });

  it('leaves students missing from a delta unchanged', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b1' }),
      rows: [active('SYN-0001'), active('SYN-0002')],
      quarantined: [],
    });

    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b2', sourceEffectiveAt: '2026-09-26T06:00:00.000Z' }),
      rows: [active('SYN-0001')],
      quarantined: [],
    });

    expect(await students.findBySourceStudentId(tenantId, 'SYN-0002')).not.toBeNull();
  });

  it('hides a student after a tombstone', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b1' }),
      rows: [active('SYN-0001')],
      quarantined: [],
    });
    const before = await students.findBySourceStudentId(tenantId, 'SYN-0001');
    if (!before) {
      throw new Error('The fixture student was not published');
    }

    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b2', sourceEffectiveAt: '2026-09-26T06:00:00.000Z' }),
      rows: [tombstone('SYN-0001')],
      quarantined: [],
    });

    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).toBeNull();
    expect(await students.findById(tenantId, before.id)).toBeNull();
  });

  it('does not let a late, older batch undo a newer tombstone', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, {
        batchId: 'new',
        sourceEffectiveAt: '2026-09-26T06:00:00.000Z',
      }),
      rows: [tombstone('SYN-0001')],
      quarantined: [],
    });

    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, {
        batchId: 'old',
        sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      }),
      rows: [active('SYN-0001')],
      quarantined: [],
    });

    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).toBeNull();
  });

  it('rolls back everything when a write inside the publish fails', async () => {
    const { roster, students, batches } = repositories();
    const tenantId = await insertTenant(testDatabase.db);

    const publish = roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId),
      rows: [active('SYN-0001')],
      quarantined: [{ rowIndex: -1, sourceRecordId: null, reason: 'VIOLATES_ROW_INDEX_CHECK' }],
    });

    await expect(publish).rejects.toThrow();
    expect(await batches.findByKey(tenantId, 'demo-sis', 'batch-0001')).toBeNull();
    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).toBeNull();
    expect(await readQuarantine(tenantId)).toEqual([]);
  });

  it('rejects a repeated batch key without applying its rows', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId),
      rows: [active('SYN-0001')],
      quarantined: [],
    });

    const repeat = roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { checksum: 'b'.repeat(64) }),
      rows: [tombstone('SYN-0001')],
      quarantined: [],
    });

    await expect(repeat).rejects.toThrow();
    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).not.toBeNull();
  });

  it('refuses a batch whose envelope names another tenant', async () => {
    const { roster } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    const otherTenantId = await insertTenant(testDatabase.db);

    const publish = roster.publishRoster(tenantId, {
      batch: buildBatch(otherTenantId),
      rows: [active('SYN-0001')],
      quarantined: [],
    });

    await expect(publish).rejects.toThrow('does not match');
    expect(await readBatchRows(otherTenantId)).toEqual([]);
  });

  it('records a quarantined batch without touching students', async () => {
    const { roster, students } = repositories();
    const tenantId = await insertTenant(testDatabase.db);
    await roster.publishRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b1' }),
      rows: [active('SYN-0001')],
      quarantined: [],
    });

    await roster.quarantineRoster(tenantId, {
      batch: buildBatch(tenantId, { batchId: 'b2', sourceEffectiveAt: '2026-09-26T06:00:00.000Z' }),
      quarantined: [{ rowIndex: 0, sourceRecordId: null, reason: 'MISSING_SOURCE_STUDENT_ID' }],
    });

    expect(await students.findBySourceStudentId(tenantId, 'SYN-0001')).not.toBeNull();
    const statuses = (await readBatchRows(tenantId)).map((row) => [row.batchId, row.status]);
    expect(statuses).toEqual(
      expect.arrayContaining([
        ['b1', ImportBatchStatus.Published],
        ['b2', ImportBatchStatus.Quarantined],
      ]),
    );
    expect(await readQuarantine(tenantId)).toHaveLength(1);
  });
});
