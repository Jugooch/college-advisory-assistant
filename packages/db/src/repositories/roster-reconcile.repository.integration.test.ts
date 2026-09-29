/**
 * @file Integration tests for `FULL` roster reconciliation in `RosterRepository.publishRoster`
 * (#30) against PostgreSQL. Kept apart from `roster.repository.integration.test.ts`, which is at
 * the file size limit.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRosterRow, ImportOperation, type InstitutionId } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import {
  buildBatch,
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createRosterRepository, type QuarantinedRow } from './roster.repository';

const T1 = '2026-09-20T06:00:00.000Z';
const T2 = '2026-09-22T06:00:00.000Z';
const T3 = '2026-09-24T06:00:00.000Z';

const active = (sourceStudentId: string) =>
  createRosterRow({ sourceStudentId, recordVersion: 1, isDeleted: false });

/** What a test can observe about a stored student, deleted ones included. */
interface StoredStudent {
  readonly isDeleted: boolean;
  readonly sourceId: string | null;
  readonly sourceEffectiveAt: string;
}

describe('RosterRepository FULL reconciliation', () => {
  let testDatabase: TestDatabase;
  let batchNumber = 0;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const publish = (
    tenantId: InstitutionId,
    options: {
      readonly operation: ImportOperation;
      readonly at: string;
      readonly ids: readonly string[];
      readonly sourceId?: string;
      readonly quarantined?: readonly QuarantinedRow[];
      readonly shouldReconcileMissing?: boolean;
    },
  ) => {
    batchNumber += 1;
    const quarantined = options.quarantined ?? [];
    return createRosterRepository(testDatabase.db).publishRoster(tenantId, {
      batch: buildBatch(tenantId, {
        batchId: `batch-${String(batchNumber)}`,
        sourceId: options.sourceId ?? 'demo-sis',
        operation: options.operation,
        sourceEffectiveAt: options.at,
        recordCount: options.ids.length + quarantined.length,
      }),
      rows: options.ids.map(active),
      quarantined,
      shouldReconcileMissing: options.shouldReconcileMissing ?? false,
    });
  };
  const delta = (tenantId: InstitutionId, at: string, ids: readonly string[]) =>
    publish(tenantId, { operation: ImportOperation.Delta, at, ids });
  const deltaFrom = (sourceId: string, tenantId: InstitutionId, at: string) =>
    publish(tenantId, { operation: ImportOperation.Delta, at, ids: ['SYN-0009'], sourceId });
  const full = (tenantId: InstitutionId, at: string, ids: readonly string[]) =>
    publish(tenantId, { operation: ImportOperation.Full, at, ids, shouldReconcileMissing: true });

  const readStudents = async (tenantId: InstitutionId) => {
    const rows = await testDatabase.db
      .select()
      .from(studentTable)
      .where(eq(studentTable.tenantId, tenantId));
    return Object.fromEntries(
      rows.map((row): [string, StoredStudent] => [
        row.sourceStudentId,
        {
          isDeleted: row.isDeleted,
          sourceId: row.sourceId,
          sourceEffectiveAt: row.sourceEffectiveAt.toISOString(),
        },
      ]),
    );
  };
  const deletedIds = async (tenantId: InstitutionId) =>
    Object.entries(await readStudents(tenantId))
      .filter(([, student]) => student.isDeleted)
      .map(([id]) => id)
      .sort();

  it('marks deleted the students a complete FULL batch no longer contains', async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002', 'SYN-0003']);

    await full(tenantId, T2, ['SYN-0001', 'SYN-0002', 'SYN-0004']);

    expect(await readStudents(tenantId)).toEqual({
      'SYN-0001': { isDeleted: false, sourceId: 'demo-sis', sourceEffectiveAt: T2 },
      'SYN-0002': { isDeleted: false, sourceId: 'demo-sis', sourceEffectiveAt: T2 },
      'SYN-0003': { isDeleted: true, sourceId: 'demo-sis', sourceEffectiveAt: T2 },
      'SYN-0004': { isDeleted: false, sourceId: 'demo-sis', sourceEffectiveAt: T2 },
    });
  });

  it("doesn't let a late, older FULL batch delete a student newer truth changed", async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002', 'SYN-0003']);
    await delta(tenantId, T3, ['SYN-0003']);

    await full(tenantId, T2, ['SYN-0001']);

    expect(await deletedIds(tenantId)).toEqual(['SYN-0002']);
    expect((await readStudents(tenantId))['SYN-0003']?.sourceEffectiveAt).toBe(T3);
  });

  it('publishes a FULL batch without deleting anyone unless told to reconcile', async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002']);

    await publish(tenantId, { operation: ImportOperation.Full, at: T2, ids: ['SYN-0001'] });

    expect(await deletedIds(tenantId)).toEqual([]);
  });

  it('refuses to reconcile a DELTA and writes nothing', async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002']);

    const publication = publish(tenantId, {
      operation: ImportOperation.Delta,
      at: T2,
      ids: ['SYN-0001'],
      shouldReconcileMissing: true,
    });

    await expect(publication).rejects.toThrow('Only a FULL roster batch can delete students');
    expect(await deletedIds(tenantId)).toEqual([]);
    expect((await readStudents(tenantId))['SYN-0001']?.sourceEffectiveAt).toBe(T1);
  });

  it("leaves a student stored at the batch's own source time alone", async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001']);
    await delta(tenantId, T2, ['SYN-0002']);

    await full(tenantId, T2, ['SYN-0001']);

    // NOTE: pins the strict "older than the batch" rule: at an equal time the source gives no
    // order, so the omission isn't applied even though the job reports COMPLETED.
    expect(await deletedIds(tenantId)).toEqual([]);
  });

  it('never changes students of another tenant, another source, or no recorded source', async () => {
    const tenantId = await insertTenant(testDatabase.db);
    const otherTenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002']);
    await deltaFrom('other-sis', tenantId, T1);
    await insertStudent(testDatabase.db, tenantId, 'SYN-0008');
    await delta(otherTenantId, T1, ['SYN-0002']);

    await full(tenantId, T2, ['SYN-0001']);

    const students = await readStudents(tenantId);
    expect(await deletedIds(tenantId)).toEqual(['SYN-0002']);
    expect(students['SYN-0009']).toMatchObject({ isDeleted: false, sourceId: 'other-sis' });
    expect(students['SYN-0008']).toMatchObject({ isDeleted: false, sourceId: null });
    expect(await deletedIds(otherTenantId)).toEqual([]);
  });

  it("doesn't let a late, older DELTA bring back a reconciled student", async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await delta(tenantId, T1, ['SYN-0001', 'SYN-0002']);
    await full(tenantId, T3, ['SYN-0001']);

    await delta(tenantId, T2, ['SYN-0002']);

    expect(await deletedIds(tenantId)).toEqual(['SYN-0002']);
  });

  it('records the source of the last accepted write on each student', async () => {
    const tenantId = await insertTenant(testDatabase.db);
    await deltaFrom('other-sis', tenantId, T1);

    await delta(tenantId, T2, ['SYN-0009']);
    await deltaFrom('third-sis', tenantId, T1);

    expect((await readStudents(tenantId))['SYN-0009']?.sourceId).toBe('demo-sis');
  });
});
