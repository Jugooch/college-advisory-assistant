/**
 * @file Integration tests for student turn log retention: the cutoff boundary and tenant scope.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId, StudentId } from '@caa/domain';

import { studentTurnLogTable } from '../tables/conversation.table';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import {
  createStudentTurnLogRepository,
  type StudentTurnLogRepository,
} from './student-turn-log.repository';

const CUTOFF = '2026-10-08T12:00:00.000Z';
const BEFORE_CUTOFF = '2026-10-08T11:59:59.999Z';
const AFTER_CUTOFF = '2026-10-08T12:00:00.001Z';

describe('student turn log repository', () => {
  let testDatabase: TestDatabase;
  let repository: StudentTurnLogRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    repository = createStudentTurnLogRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const createWorld = async (label: string) => {
    const tenantId: InstitutionId = await insertTenant(testDatabase.db);
    const studentId: StudentId = await insertStudent(testDatabase.db, tenantId, `S-${label}`);
    return { tenantId, studentId };
  };

  const log = async (world: { tenantId: InstitutionId; studentId: StudentId }, at: string[]) => {
    await testDatabase.db
      .insert(studentTurnLogTable)
      .values(at.map((createdAt) => ({ ...world, createdAt: new Date(createdAt) })));
  };

  const remaining = async (tenantId: InstitutionId) => {
    const rows = await testDatabase.db
      .select({ createdAt: studentTurnLogTable.createdAt })
      .from(studentTurnLogTable)
      .where(eq(studentTurnLogTable.tenantId, tenantId));
    return rows.map((row) => row.createdAt.toISOString()).sort();
  };

  it('deletes rows older than the cutoff and keeps the row exactly at it and newer ones', async () => {
    const world = await createWorld('boundary');
    await log(world, [BEFORE_CUTOFF, CUTOFF, AFTER_CUTOFF]);

    const deleted = await repository.pruneBefore({ tenantId: world.tenantId, before: CUTOFF });

    expect(deleted).toBe(1);
    expect(await remaining(world.tenantId)).toEqual([CUTOFF, AFTER_CUTOFF]);
  });

  it('deletes nothing on a second run', async () => {
    const world = await createWorld('idempotent');
    await log(world, [BEFORE_CUTOFF, AFTER_CUTOFF]);
    await repository.pruneBefore({ tenantId: world.tenantId, before: CUTOFF });

    expect(await repository.pruneBefore({ tenantId: world.tenantId, before: CUTOFF })).toBe(0);
    expect(await remaining(world.tenantId)).toEqual([AFTER_CUTOFF]);
  });

  it("never deletes another tenant's rows", async () => {
    const mine = await createWorld('mine');
    const other = await createWorld('other');
    await log(other, [BEFORE_CUTOFF]);

    expect(await repository.pruneBefore({ tenantId: mine.tenantId, before: CUTOFF })).toBe(0);
    expect(await remaining(other.tenantId)).toEqual([BEFORE_CUTOFF]);
  });
});
