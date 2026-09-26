/**
 * @file Integration tests for the advisor assignment repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId, StudentId, UserId } from '@caa/domain';

import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import {
  insertStudent,
  insertTenant,
  insertUser,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { createAdvisorAssignmentRepository } from './advisor-assignment.repository';

const EFFECTIVE_FROM = '2026-08-15T00:00:00.000Z';
const EFFECTIVE_TO = '2026-12-20T00:00:00.000Z';

describe('AdvisorAssignmentRepository.findActive', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;
  let advisorUserId: UserId;
  let otherAdvisorUserId: UserId;
  let boundedStudentId: StudentId;
  let openStudentId: StudentId;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    const { db } = testDatabase;
    tenantId = await insertTenant(db);
    advisorUserId = await insertUser(db, tenantId, 'advisor');
    otherAdvisorUserId = await insertUser(db, tenantId, 'other-advisor');
    const approverId = await insertUser(db, tenantId, 'approver');
    boundedStudentId = await insertStudent(db, tenantId, 'SYN-0001');
    openStudentId = await insertStudent(db, tenantId, 'SYN-0002');
    await db.insert(advisorAssignmentTable).values([
      {
        tenantId,
        advisorUserId,
        studentId: boundedStudentId,
        effectiveFrom: new Date(EFFECTIVE_FROM),
        effectiveTo: new Date(EFFECTIVE_TO),
        approvedBy: approverId,
      },
      {
        tenantId,
        advisorUserId,
        studentId: openStudentId,
        effectiveFrom: new Date(EFFECTIVE_FROM),
        effectiveTo: null,
        approvedBy: approverId,
      },
    ]);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const findBounded = (at: string, advisor: UserId = advisorUserId) =>
    createAdvisorAssignmentRepository(testDatabase.db).findActive(tenantId, {
      advisorUserId: advisor,
      studentId: boundedStudentId,
      at,
    });

  it('is active exactly at effectiveFrom (start inclusive)', async () => {
    const assignment = await findBounded(EFFECTIVE_FROM);

    expect(assignment?.studentId).toBe(boundedStudentId);
    expect(assignment?.effectiveFrom).toBe(EFFECTIVE_FROM);
    expect(assignment?.effectiveTo).toBe(EFFECTIVE_TO);
  });

  it('is not active one millisecond before effectiveFrom', async () => {
    expect(await findBounded('2026-08-14T23:59:59.999Z')).toBeNull();
  });

  it('is active one millisecond before effectiveTo', async () => {
    expect(await findBounded('2026-12-19T23:59:59.999Z')).not.toBeNull();
  });

  it('is not active exactly at effectiveTo (end exclusive)', async () => {
    expect(await findBounded(EFFECTIVE_TO)).toBeNull();
  });

  it('compares instants, not local wall-clock text', async () => {
    expect(await findBounded('2026-08-14T19:00:00.000-05:00')).not.toBeNull();
  });

  it('stays active with no end date', async () => {
    const assignment = await createAdvisorAssignmentRepository(testDatabase.db).findActive(
      tenantId,
      { advisorUserId, studentId: openStudentId, at: '2030-01-01T00:00:00.000Z' },
    );

    expect(assignment?.effectiveTo).toBeNull();
  });

  it('is not active for a different advisor', async () => {
    expect(await findBounded('2026-10-01T00:00:00.000Z', otherAdvisorUserId)).toBeNull();
  });

  it('is not visible from a different tenant', async () => {
    const otherTenantId = await insertTenant(testDatabase.db);

    const assignment = await createAdvisorAssignmentRepository(testDatabase.db).findActive(
      otherTenantId,
      { advisorUserId, studentId: boundedStudentId, at: '2026-10-01T00:00:00.000Z' },
    );

    expect(assignment).toBeNull();
  });

  it('rejects an invalid instant', async () => {
    await expect(findBounded('not-a-date')).rejects.toThrow(RangeError);
  });

  it("can't reference another tenant's student", async () => {
    const { db } = testDatabase;
    const otherTenantId = await insertTenant(db);
    const otherAdvisorId = await insertUser(db, otherTenantId, 'advisor');

    const insert = db.insert(advisorAssignmentTable).values({
      tenantId: otherTenantId,
      advisorUserId: otherAdvisorId,
      studentId: boundedStudentId,
      effectiveFrom: new Date(EFFECTIVE_FROM),
      effectiveTo: null,
      approvedBy: otherAdvisorId,
    });

    await expect(insert).rejects.toThrow();
  });
});
