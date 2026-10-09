/**
 * @file Integration tests for revising a chosen demo student, and for resetting the database.
 *   Both run in their own database because a newer revision becomes the latest truth for every
 *   later reader, and a reset removes everything.
 */
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InstitutionIdSchema, StudentIdSchema } from '@caa/domain';

import { createStudentSnapshotRepository } from '../repositories/student-snapshot.repository';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { studentTable } from '../tables/student.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import type { TestDatabase } from '../testing/integration-fixtures';
import { openIsolatedTestDatabase } from '../testing/isolated-database';
import { buildDemoSeedPlan } from './dev-seed-demo-plan';
import { resetDatabase } from './reset-database';
import {
  ReviseNotSeededError,
  reviseSliceSources,
  ReviseUnknownStudentError,
} from './revise-slice-sources';
import { seedDevData } from './seed-dev-data';

const SEED_RUN = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDemoSeedPlan(SEED_RUN);
const TENANT = InstitutionIdSchema.parse(PLAN.institutions[0]?.id);
const HOUR_MS = 3_600_000;
const FIRST = new Date(SEED_RUN.getTime() + HOUR_MS);
const SECOND = new Date(SEED_RUN.getTime() + 2 * HOUR_MS);
const STALE_PERSONA = 'SYN-000006';
const OTHER_PERSONA = 'SYN-000004';

function studentIdOf(sourceStudentId: string) {
  const student = PLAN.students.find((candidate) => candidate.sourceStudentId === sourceStudentId);
  return StudentIdSchema.parse(student?.id);
}

describe('reviseSliceSources for a chosen student', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openIsolatedTestDatabase();
    await seedDevData(testDatabase.db, PLAN);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  async function snapshotIds(studentId: string): Promise<string[]> {
    const rows = await testDatabase.db
      .select({ id: studentSnapshotTable.id })
      .from(studentSnapshotTable)
      .where(eq(studentSnapshotTable.studentId, studentId));
    return rows.map((row) => row.id).sort();
  }

  async function attemptIds(studentId: string): Promise<string[]> {
    const rows = await testDatabase.db
      .select({ id: courseAttemptTable.id })
      .from(courseAttemptTable)
      .where(eq(courseAttemptTable.studentId, studentId));
    return rows.map((row) => row.id).sort();
  }

  it('supersedes the chosen student record only, so a draft pinned to the old one reads stale', async () => {
    const snapshots = createStudentSnapshotRepository(testDatabase.db);
    const persona = studentIdOf(STALE_PERSONA);
    const seeded = await snapshots.findLatest(TENANT, persona);
    const otherBefore = await snapshots.findLatest(TENANT, studentIdOf(OTHER_PERSONA));

    const result = await reviseSliceSources(
      testDatabase.db,
      { target: 'student', sourceStudentId: STALE_PERSONA },
      FIRST,
    );

    const latest = await snapshots.findLatest(TENANT, persona);
    if (seeded?.status !== 'FOUND' || latest?.status !== 'FOUND') {
      throw new Error('the persona has no snapshot');
    }
    expect(result).toEqual({ target: 'student', published: true });
    // NOTE: the freshness rule flags StudentRecordSuperseded when the latest snapshot ID differs
    // from the one a revision pinned; the seeded snapshot is what a saved plan would pin.
    expect(latest.revision.snapshot.id).not.toBe(seeded.revision.snapshot.id);
    expect(latest.revision.snapshot.sourceEffectiveAt).toBe(FIRST.toISOString());
    expect(latest.revision.snapshot.attemptIds).toEqual([
      ...seeded.revision.snapshot.attemptIds,
      '60000000-1006-4000-8000-01a0f78ce080',
    ]);
    expect(await snapshots.findLatest(TENANT, studentIdOf(OTHER_PERSONA))).toEqual(otherBefore);
  });

  it('writes the same rows when the same run is repeated', async () => {
    const persona = studentIdOf(STALE_PERSONA);
    await reviseSliceSources(
      testDatabase.db,
      { target: 'student', sourceStudentId: STALE_PERSONA },
      SECOND,
    );
    const snapshotsBefore = await snapshotIds(persona);
    const attemptsBefore = await attemptIds(persona);

    const repeat = await reviseSliceSources(
      testDatabase.db,
      { target: 'student', sourceStudentId: STALE_PERSONA },
      SECOND,
    );

    expect(repeat.published).toBe(false);
    expect(await snapshotIds(persona)).toEqual(snapshotsBefore);
    expect(await attemptIds(persona)).toEqual(attemptsBefore);
  });

  it('refuses a student outside the seed and writes nothing', async () => {
    const [before] = await testDatabase.db.select({ n: count() }).from(studentSnapshotTable);

    await expect(
      reviseSliceSources(
        testDatabase.db,
        { target: 'student', sourceStudentId: 'SYN-999999' },
        SECOND,
      ),
    ).rejects.toBeInstanceOf(ReviseUnknownStudentError);
    // NOTE: seeded, but without a record (SYN-000003) or in another tenant (SYN-000101).
    for (const unrecorded of ['SYN-000003', 'SYN-000101']) {
      await expect(
        reviseSliceSources(
          testDatabase.db,
          { target: 'student', sourceStudentId: unrecorded },
          SECOND,
        ),
      ).rejects.toBeInstanceOf(ReviseUnknownStudentError);
    }
    await expect(
      reviseSliceSources(
        testDatabase.db,
        { target: 'student', sourceStudentId: "x'; DROP TABLE student;--" },
        SECOND,
      ),
    ).rejects.toBeInstanceOf(ReviseUnknownStudentError);

    const [after] = await testDatabase.db.select({ n: count() }).from(studentSnapshotTable);
    expect(after).toEqual(before);
  });
});

describe('reviseSliceSources for a seeded student whose data is missing', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openIsolatedTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('asks for the seed first', async () => {
    await expect(
      reviseSliceSources(
        testDatabase.db,
        { target: 'student', sourceStudentId: STALE_PERSONA },
        FIRST,
      ),
    ).rejects.toBeInstanceOf(ReviseNotSeededError);
  });
});

describe('resetDatabase', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openIsolatedTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('removes every row, leaves a migrated schema, and can be repeated and reseeded', async () => {
    await seedDevData(testDatabase.db, PLAN);
    const [seeded] = await testDatabase.db.select({ n: count() }).from(studentTable);
    expect(seeded?.n).toBeGreaterThan(0);

    await resetDatabase(testDatabase.db);
    await resetDatabase(testDatabase.db);

    const [emptied] = await testDatabase.db.select({ n: count() }).from(studentTable);
    expect(emptied?.n).toBe(0);
    await seedDevData(testDatabase.db, PLAN);
    const [reseeded] = await testDatabase.db.select({ n: count() }).from(studentTable);
    expect(reseeded?.n).toBe(seeded?.n);
  });
});
