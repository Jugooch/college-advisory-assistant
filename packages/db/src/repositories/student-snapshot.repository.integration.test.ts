/**
 * @file Integration tests for the student snapshot repository against PostgreSQL.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AttemptStatus, GradeScheme, type InstitutionId, type StudentId } from '@caa/domain';

import { studentTable } from '../tables/student.table';
import { insertCourse, violationOf } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { insertAttempt, insertSnapshot } from '../testing/snapshot-fixtures';
import { createStudentSnapshotRepository } from './student-snapshot.repository';

describe('StudentSnapshotRepository', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const repository = () => createStudentSnapshotRepository(testDatabase.db);

  const setUpStudent = async (): Promise<{ tenantId: InstitutionId; studentId: StudentId }> => {
    const tenantId = await insertTenant(testDatabase.db);
    const studentId = await insertStudent(testDatabase.db, tenantId, 'SYN-0001');
    return { tenantId, studentId };
  };

  const latestId = async (tenantId: InstitutionId, studentId: StudentId) => {
    const latest = await repository().findLatest(tenantId, studentId);
    return latest?.status === 'FOUND' ? latest.revision.snapshot.id : latest;
  };

  it('picks the newest source effective time, not the newest ingestion', async () => {
    const { tenantId, studentId } = await setUpStudent();
    const newer = await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      ingestedAt: '2026-09-20T07:00:00.000Z',
    });
    await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
      ingestedAt: '2026-09-25T07:00:00.000Z',
    });

    expect(await latestId(tenantId, studentId)).toBe(newer);
  });

  it('reports AMBIGUOUS when source effective times are equal, whatever the ingestion', async () => {
    const { tenantId, studentId } = await setUpStudent();
    const sourceEffectiveAt = '2026-09-20T06:00:00.000Z';
    await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt,
      ingestedAt: '2026-09-20T07:00:00.000Z',
    });
    await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt,
      ingestedAt: '2026-09-21T07:00:00.000Z',
    });

    expect(await repository().findLatest(tenantId, studentId)).toEqual({ status: 'AMBIGUOUS' });
  });

  it('ignores a tie between older snapshots when a strictly newer one exists', async () => {
    const { tenantId, studentId } = await setUpStudent();
    const older = { studentId, sourceEffectiveAt: '2026-09-10T06:00:00.000Z' };
    await insertSnapshot(testDatabase.db, tenantId, older);
    await insertSnapshot(testDatabase.db, tenantId, older);
    const newest = await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
    });

    expect(await latestId(tenantId, studentId)).toBe(newest);
  });

  it('round-trips every attempt status in the snapshot order', async () => {
    const { db } = testDatabase;
    const { tenantId, studentId } = await setUpStudent();
    const courseId = await insertCourse(db, tenantId);
    const letter = (value: string) => ({ gradeScheme: GradeScheme.Letter, gradeValue: value });
    const fixtures = [
      { status: AttemptStatus.Completed, ...letter('B'), creditsEarnedHundredths: 300 },
      { status: AttemptStatus.InProgress },
      { status: AttemptStatus.Withdrawn, ...letter('F') },
      { status: AttemptStatus.Incomplete },
      { status: AttemptStatus.TransferPending },
      { status: AttemptStatus.TransferAwarded, creditsEarnedHundredths: 400 },
    ];
    const attemptIds = [];
    for (const [index, fixture] of fixtures.entries()) {
      const sourceAttemptId = `SYN-ATT-${String(index)}`;
      attemptIds.push(
        await insertAttempt(db, tenantId, { studentId, courseId, sourceAttemptId, ...fixture }),
      );
    }
    const snapshotId = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      attemptIds: attemptIds.toReversed(),
    });

    const revision = await repository().findById(tenantId, snapshotId);

    expect(revision?.snapshot.attemptIds).toEqual(attemptIds.toReversed());
    expect(
      revision?.attempts.map(({ status, grade, creditsEarnedHundredths }) => ({
        status,
        grade,
        creditsEarnedHundredths,
      })),
    ).toEqual([
      { status: 'TRANSFER_AWARDED', grade: null, creditsEarnedHundredths: 400 },
      { status: 'TRANSFER_PENDING', grade: null, creditsEarnedHundredths: null },
      { status: 'INCOMPLETE', grade: null, creditsEarnedHundredths: null },
      {
        status: 'WITHDRAWN',
        grade: { scheme: 'LETTER', value: 'F' },
        creditsEarnedHundredths: null,
      },
      { status: 'IN_PROGRESS', grade: null, creditsEarnedHundredths: null },
      {
        status: 'COMPLETED',
        grade: { scheme: 'LETTER', value: 'B' },
        creditsEarnedHundredths: 300,
      },
    ]);
  });

  it('keeps an older snapshot unchanged when a newer one carries a revised attempt', async () => {
    const { db } = testDatabase;
    const { tenantId, studentId } = await setUpStudent();
    const courseId = await insertCourse(db, tenantId);
    const unchanged = await insertAttempt(db, tenantId, {
      studentId,
      courseId,
      sourceAttemptId: 'SYN-ATT-1',
    });
    const inProgress = await insertAttempt(db, tenantId, {
      studentId,
      courseId,
      sourceAttemptId: 'SYN-ATT-2',
    });
    const older = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
      attemptIds: [unchanged, inProgress],
    });
    const graded = await insertAttempt(db, tenantId, {
      studentId,
      courseId,
      sourceAttemptId: 'SYN-ATT-2',
      status: AttemptStatus.Completed,
      gradeScheme: GradeScheme.Letter,
      gradeValue: 'A',
      creditsEarnedHundredths: 300,
    });
    const newer = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      attemptIds: [unchanged, graded],
    });

    const pinned = await repository().findById(tenantId, older);

    expect(pinned?.snapshot.attemptIds).toEqual([unchanged, inProgress]);
    expect(pinned?.attempts[1]?.status).toBe('IN_PROGRESS');
    expect(await latestId(tenantId, studentId)).toBe(newer);
  });

  it("does not return another tenant's snapshots", async () => {
    const { tenantId, studentId } = await setUpStudent();
    const snapshotId = await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
    });
    const otherTenantId = await insertTenant(testDatabase.db);

    expect(await repository().findLatest(otherTenantId, studentId)).toBeNull();
    expect(await repository().findById(otherTenantId, snapshotId)).toBeNull();
  });

  it('hides the snapshots of a student the source deleted', async () => {
    const { tenantId, studentId } = await setUpStudent();
    await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
    });

    await testDatabase.db
      .update(studentTable)
      .set({ isDeleted: true })
      .where(eq(studentTable.id, studentId));

    expect(await repository().findLatest(tenantId, studentId)).toBeNull();
  });

  it('exposes no method that changes a snapshot', () => {
    expect(Object.keys(repository())).toEqual(['findLatest', 'findById']);
  });

  it("can't list another student's attempt in a snapshot", async () => {
    const { db } = testDatabase;
    const { tenantId, studentId } = await setUpStudent();
    const otherStudentId = await insertStudent(db, tenantId, 'SYN-0002');
    const courseId = await insertCourse(db, tenantId);
    const othersAttempt = await insertAttempt(db, tenantId, {
      studentId: otherStudentId,
      courseId,
    });

    const insert = insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      attemptIds: [othersAttempt],
    });

    await expect(insert).rejects.toMatchObject(violationOf('student_snapshot_attempt_attempt_fk'));
  });

  it("can't record an attempt for another tenant's student", async () => {
    const { db } = testDatabase;
    const { studentId } = await setUpStudent();
    const otherTenantId = await insertTenant(db);
    const courseId = await insertCourse(db, otherTenantId);

    const insert = insertAttempt(db, otherTenantId, { studentId, courseId });

    await expect(insert).rejects.toMatchObject(violationOf('course_attempt_student_fk'));
  });

  it('refuses to store a grade on an in-progress attempt', async () => {
    const { db } = testDatabase;
    const { tenantId, studentId } = await setUpStudent();
    const courseId = await insertCourse(db, tenantId);

    const insert = insertAttempt(db, tenantId, {
      studentId,
      courseId,
      gradeScheme: GradeScheme.Letter,
      gradeValue: 'A',
    });

    await expect(insert).rejects.toMatchObject(
      violationOf('course_attempt_ungraded_status_has_no_grade'),
    );
  });
});
