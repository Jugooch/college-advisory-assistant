/**
 * @file Integration test for the demo seed against PostgreSQL: personas, identities, assignments,
 *   idempotency, and that the dev seed alone still writes what it did.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { studentTable } from '../tables/student.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';
import { userIdentityTable } from '../tables/user-identity.table';
import { openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { buildDemoSeedPlan } from './dev-seed-demo-plan';
import { buildDevSeedPlan, DEV_SEED_ISSUER } from './dev-seed-plan';
import { seedDevData } from './seed-dev-data';

const RUN = new Date('2026-10-03T12:00:00.000Z');
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

  /** Removes the demo-only rows so other files see only what the dev seed wrote. */
  async function removeDemoRows(): Promise<void> {
    const { db } = testDatabase;
    const snapshotIds = DEMO_PLAN.academic.snapshots
      .filter((snapshot) => DEMO_STUDENT_IDS.includes(snapshot.studentId))
      .map((snapshot) => snapshot.id);
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

  async function countDemoStudents(): Promise<number | undefined> {
    const [row] = await testDatabase.db
      .select({ n: count() })
      .from(studentTable)
      .where(inArray(studentTable.id, DEMO_STUDENT_IDS));
    return row?.n;
  }

  it('writes nothing of the demo from the dev seed alone', async () => {
    await seedDevData(testDatabase.db, DEV_PLAN);

    expect(await countDemoStudents()).toBe(0);
  });

  it('writes the personas, identities, assignments and records, and is idempotent', async () => {
    const first = await seedDevData(testDatabase.db, DEMO_PLAN);
    const second = await seedDevData(testDatabase.db, DEMO_PLAN);

    expect(second).toEqual(first);
    expect(await countDemoStudents()).toBe(3);
    const { db } = testDatabase;
    const identities = await db
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
    const assignments = await db
      .select({ n: count() })
      .from(advisorAssignmentTable)
      .where(inArray(advisorAssignmentTable.studentId, DEMO_STUDENT_IDS));
    expect(assignments[0]?.n).toBe(3);
    const attempts = await db
      .select({ n: count() })
      .from(courseAttemptTable)
      .where(inArray(courseAttemptTable.studentId, DEMO_STUDENT_IDS));
    expect(attempts[0]?.n).toBe(3);
  });
});
