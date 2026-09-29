/**
 * @file Integration tests for the `@caa/db/testing` seed scenario writer against PostgreSQL.
 *   Uses the same run time as the dev seed tests, because every file shares one database.
 */
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPrerequisiteRule,
  type InstitutionId,
  InstitutionIdSchema,
  PrerequisiteExpressionType,
  StudentIdSchema,
} from '@caa/domain';

import { createAuditSnapshotRepository } from '../repositories/audit-snapshot.repository';
import { createStudentRepository } from '../repositories/student.repository';
import { createStudentSnapshotRepository } from '../repositories/student-snapshot.repository';
import { prerequisiteRuleTable } from '../tables/prerequisite-rule.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import {
  AcademicSeedReferenceError,
  buildDevSeedPlan,
  type DevSeedPlan,
  openTestDatabase,
  type TestDatabase,
  writeSeedScenario,
} from '../testing';

/** Same run time as `seed-dev-data.integration.test.ts`, so either file may run first. */
const RUN_TIME = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDevSeedPlan(RUN_TIME);
const TENANT = InstitutionIdSchema.parse(PLAN.academic.policy.tenantId);

/**
 * Reads whether a seeded student's latest audit is pinned to that student's latest snapshot.
 *
 * @param testDatabase - Open test database.
 * @param tenantId - Seeded tenant.
 * @param sourceStudentId - Seeded source ID, such as `SYN-000001`.
 * @returns True when current, false when pinned to an older snapshot.
 */
async function isAuditOnLatestSnapshot(
  testDatabase: TestDatabase,
  tenantId: InstitutionId,
  sourceStudentId: string,
): Promise<boolean> {
  const { db } = testDatabase;
  const student = await createStudentRepository(db).findBySourceStudentId(
    tenantId,
    sourceStudentId,
  );
  const studentId = StudentIdSchema.parse(student?.id);
  const snapshot = await createStudentSnapshotRepository(db).findLatest(tenantId, studentId);
  const audit = await createAuditSnapshotRepository(db).findLatest(tenantId, studentId);
  if (snapshot?.status !== 'FOUND' || audit?.status !== 'FOUND') {
    throw new Error('The seeded student has no latest snapshot or audit');
  }
  return audit.audit.studentSnapshotId === snapshot.revision.snapshot.id;
}

/**
 * Counts one tenant's rows of the tables the tests change.
 *
 * @param testDatabase - Open test database.
 * @returns Prerequisite rule and snapshot counts.
 */
async function countRows(testDatabase: TestDatabase) {
  const { db } = testDatabase;
  const [rules] = await db
    .select({ n: count() })
    .from(prerequisiteRuleTable)
    .where(eq(prerequisiteRuleTable.tenantId, TENANT));
  const [snapshots] = await db
    .select({ n: count() })
    .from(studentSnapshotTable)
    .where(eq(studentSnapshotTable.tenantId, TENANT));
  return { rules: rules?.n, snapshots: snapshots?.n };
}

describe('writeSeedScenario', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('writes the dev seed scenarios so SYN-000001 is current and SYN-000002 is stale', async () => {
    const counts = await writeSeedScenario(testDatabase.db, { now: RUN_TIME });

    expect(counts).toMatchObject({ students: 4, studentSnapshots: 3, auditSnapshots: 2 });
    expect(await isAuditOnLatestSnapshot(testDatabase, TENANT, 'SYN-000001')).toBe(true);
    expect(await isAuditOnLatestSnapshot(testDatabase, TENANT, 'SYN-000002')).toBe(false);
  });

  it('writes a given plan, and leaves the same rows when that plan is written again', async () => {
    await writeSeedScenario(testDatabase.db, { plan: PLAN });
    const before = await countRows(testDatabase);

    const counts = await writeSeedScenario(testDatabase.db, { plan: PLAN });

    expect(await countRows(testDatabase)).toEqual(before);
    expect(counts.prerequisiteRules).toBe(PLAN.academic.rules.length);
  });

  it('refuses a given plan with an uncatalogued rule course and writes nothing', async () => {
    const [firstRule] = PLAN.academic.rules;
    if (!firstRule) {
      throw new Error('The seed plan has no rules');
    }
    const orphanRule = createPrerequisiteRule({
      ...firstRule,
      rulesetVersion: 'demo-2099.2',
      expression: {
        type: PrerequisiteExpressionType.Course,
        courseId: '50000000-0000-4000-8000-00000000fffe',
        minimumGrade: null,
      },
    });
    const plan: DevSeedPlan = {
      ...PLAN,
      academic: { ...PLAN.academic, rules: [...PLAN.academic.rules, orphanRule] },
    };
    const before = await countRows(testDatabase);

    await expect(writeSeedScenario(testDatabase.db, { plan })).rejects.toThrow(
      AcademicSeedReferenceError,
    );
    expect(await countRows(testDatabase)).toEqual(before);
  });
});
