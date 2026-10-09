/**
 * @file Integration test for the demo seed against PostgreSQL: personas, identities, assignments,
 *   idempotency, and that the dev seed alone still writes what it did.
 */
import { and, count, eq, inArray, type SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { auditSnapshotTable } from '../tables/audit-snapshot.table';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { requirementResultTable } from '../tables/requirement-result.table';
import { studentTable } from '../tables/student.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';
import { userIdentityTable } from '../tables/user-identity.table';
import { openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildDemoSeedPlan } from './dev-seed-demo-plan';
import { buildDevSeedPlan, DEV_SEED_ISSUER } from './dev-seed-plan';
import { seedDevData } from './seed-dev-data';

// NOTE: the same run time as the other seed tests, so the dev rows written here are the very
// rows they write (idempotent upserts) and their absolute counts hold in any file order.
const RUN = new Date('2026-10-01T12:00:00.000Z');
const DEMO_PLAN = buildDemoSeedPlan(RUN);
const DEV_PLAN = buildDevSeedPlan(RUN);
const TENANT = DEV_PLAN.institutions[0]?.id ?? '';
const DEMO_STUDENT_IDS = DEMO_PLAN.students
  .slice(DEV_PLAN.students.length)
  .map((student) => student.id);

describe('demo seed', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  /** Removes the demo-only rows, so other files' absolute counts see no extra persona rows. */
  async function removeDemoRows(): Promise<void> {
    const { db } = testDatabase;
    const snapshotIds = DEMO_PLAN.academic.snapshots
      .filter((snapshot) => DEMO_STUDENT_IDS.includes(snapshot.studentId))
      .map((snapshot) => snapshot.id);
    const auditIds = DEMO_PLAN.academic.audits
      .filter((audit) => DEMO_STUDENT_IDS.includes(audit.studentId))
      .map((audit) => audit.id);
    await db
      .delete(requirementResultTable)
      .where(inArray(requirementResultTable.auditSnapshotId, auditIds));
    await db.delete(auditSnapshotTable).where(inArray(auditSnapshotTable.id, auditIds));
    await db
      .delete(advisorAssignmentTable)
      .where(inArray(advisorAssignmentTable.studentId, DEMO_STUDENT_IDS));
    await db
      .delete(studentSnapshotAttemptTable)
      .where(inArray(studentSnapshotAttemptTable.studentSnapshotId, snapshotIds));
    await db.delete(studentSnapshotTable).where(inArray(studentSnapshotTable.id, snapshotIds));
    await db
      .delete(courseAttemptTable)
      .where(inArray(courseAttemptTable.studentId, DEMO_STUDENT_IDS));
    await db.delete(studentTable).where(inArray(studentTable.id, DEMO_STUDENT_IDS));
    await db.delete(userIdentityTable).where(
      and(
        eq(userIdentityTable.tenantId, TENANT),
        inArray(
          userIdentityTable.subject,
          DEMO_PLAN.identities.slice(DEV_PLAN.identities.length).map((i) => i.subject),
        ),
      ),
    );
  }

  afterAll(async () => {
    await removeDemoRows();
    await testDatabase.close();
  });

  it('writes nothing of the demo from the dev seed alone', async () => {
    await seedDevData(testDatabase.db, DEV_PLAN);

    expect((await countPersonaRows()).students).toBe(0);
  });

  /** Counts the demo persona rows in the tables the seed writes for them. */
  async function countPersonaRows(): Promise<Record<string, number | undefined>> {
    const { db } = testDatabase;
    const snapshotIds = DEMO_PLAN.academic.snapshots.slice(3).map((snapshot) => snapshot.id);
    const countWhere = async (
      table:
        | typeof studentTable
        | typeof advisorAssignmentTable
        | typeof courseAttemptTable
        | typeof studentSnapshotTable
        | typeof studentSnapshotAttemptTable
        | typeof auditSnapshotTable,
      condition: SQL,
    ) => (await db.select({ n: count() }).from(table).where(condition))[0]?.n;
    return {
      students: await countWhere(studentTable, inArray(studentTable.id, DEMO_STUDENT_IDS)),
      assignments: await countWhere(
        advisorAssignmentTable,
        inArray(advisorAssignmentTable.studentId, DEMO_STUDENT_IDS),
      ),
      attempts: await countWhere(
        courseAttemptTable,
        inArray(courseAttemptTable.studentId, DEMO_STUDENT_IDS),
      ),
      snapshots: await countWhere(
        studentSnapshotTable,
        inArray(studentSnapshotTable.id, snapshotIds),
      ),
      links: await countWhere(
        studentSnapshotAttemptTable,
        inArray(studentSnapshotAttemptTable.studentSnapshotId, snapshotIds),
      ),
      audits: await countWhere(
        auditSnapshotTable,
        inArray(auditSnapshotTable.studentId, DEMO_STUDENT_IDS),
      ),
    };
  }

  it('writes the personas, identities, assignments and records, and is idempotent', async () => {
    await seedDevData(testDatabase.db, DEMO_PLAN);
    const afterFirst = await countPersonaRows();
    await seedDevData(testDatabase.db, DEMO_PLAN);

    expect(afterFirst).toEqual({
      students: 3,
      assignments: 3,
      attempts: 4,
      snapshots: 3,
      links: 4,
      audits: 3,
    });
    expect(await countPersonaRows()).toEqual(afterFirst);
    const identities = await testDatabase.db
      .select({ subject: userIdentityTable.subject })
      .from(userIdentityTable)
      .where(
        and(
          eq(userIdentityTable.issuer, DEV_SEED_ISSUER),
          inArray(userIdentityTable.subject, [
            'synthetic-student-004',
            'synthetic-student-005',
            'synthetic-student-006',
          ]),
        ),
      );
    expect(identities).toHaveLength(3);
  });

  it('links each persona snapshot to its attempt', async () => {
    await seedDevData(testDatabase.db, DEMO_PLAN);

    const links = await testDatabase.db
      .select({ attemptId: studentSnapshotAttemptTable.courseAttemptId })
      .from(studentSnapshotAttemptTable)
      .where(
        inArray(
          studentSnapshotAttemptTable.studentSnapshotId,
          DEMO_PLAN.academic.snapshots.slice(3).map((snapshot) => snapshot.id),
        ),
      );
    expect(links.map((link) => link.attemptId).sort()).toEqual([
      '60000000-0000-4000-8000-000000000104',
      '60000000-0000-4000-8000-000000000105',
      '60000000-0000-4000-8000-000000000106',
    ]);
  });
});
