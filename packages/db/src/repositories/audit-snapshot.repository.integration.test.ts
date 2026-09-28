/**
 * @file Integration tests for the audit snapshot repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  AttemptStatus,
  GradeScheme,
  type InstitutionId,
  RequirementState,
  type StudentId,
  type StudentSnapshotId,
} from '@caa/domain';

import { insertCourse, violationOf } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import { insertAttempt, insertAudit, insertSnapshot } from '../testing/snapshot-fixtures';
import { createAuditSnapshotRepository } from './audit-snapshot.repository';
import { createStudentSnapshotRepository } from './student-snapshot.repository';

interface AuditSubject {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly snapshotId: StudentSnapshotId;
}

describe('AuditSnapshotRepository.findLatest', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const audits = () => createAuditSnapshotRepository(testDatabase.db);

  const setUpSubject = async (): Promise<AuditSubject> => {
    const tenantId = await insertTenant(testDatabase.db);
    const studentId = await insertStudent(testDatabase.db, tenantId, 'SYN-0001');
    const snapshotId = await insertSnapshot(testDatabase.db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
    });
    return { tenantId, studentId, snapshotId };
  };

  const root = [{ sourceRequirementId: 'REQ-ROOT' }];

  const latestVersion = async ({ tenantId, studentId }: AuditSubject) => {
    const latest = await audits().findLatest(tenantId, studentId);
    return latest?.status === 'FOUND' ? latest.audit.auditVersion : latest;
  };

  it('round-trips a requirement tree in audit order', async () => {
    const subject = await setUpSubject();
    const { db } = testDatabase;
    const courseId = await insertCourse(db, subject.tenantId);
    const attemptId = await insertAttempt(db, subject.tenantId, {
      studentId: subject.studentId,
      courseId,
    });
    await insertAudit(db, subject.tenantId, {
      studentId: subject.studentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: [
        // NOTE: a child before its parent in audit order, which the parent key must allow.
        {
          sourceRequirementId: 'REQ-MATH-101',
          parentSourceRequirementId: 'REQ-MATH',
          state: RequirementState.InProgress,
          allocatedAttemptIds: [attemptId],
          candidateCourseIds: [courseId],
          remainingCourseCount: 1,
          isReusable: true,
        },
        { sourceRequirementId: 'REQ-CORE', state: RequirementState.Ambiguous },
        {
          sourceRequirementId: 'REQ-MATH',
          parentSourceRequirementId: 'REQ-CORE',
          state: RequirementState.Complete,
          remainingCreditsHundredths: 0,
        },
      ],
    });

    const latest = await audits().findLatest(subject.tenantId, subject.studentId);

    expect(latest?.status === 'FOUND' && latest.audit.requirements).toEqual([
      {
        sourceRequirementId: 'REQ-MATH-101',
        parentSourceRequirementId: 'REQ-MATH',
        label: 'Synthetic requirement',
        state: 'IN_PROGRESS',
        allocatedAttemptIds: [attemptId],
        remainingCreditsHundredths: null,
        remainingCourseCount: 1,
        candidateCourseIds: [courseId],
        isReusable: true,
        sourceRef: 'demo-audit:REQ-MATH-101',
      },
      expect.objectContaining({ sourceRequirementId: 'REQ-CORE', state: 'AMBIGUOUS' }),
      expect.objectContaining({
        sourceRequirementId: 'REQ-MATH',
        parentSourceRequirementId: 'REQ-CORE',
        state: 'COMPLETE',
        remainingCreditsHundredths: 0,
      }),
    ]);
  });

  it('keeps the snapshot an older audit ran against when a newer snapshot arrives', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const studentId = await insertStudent(db, tenantId, 'SYN-0001');
    const courseId = await insertCourse(db, tenantId);
    const enrolled = await insertAttempt(db, tenantId, { studentId, courseId });
    const older = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
      attemptIds: [enrolled],
    });
    await insertAudit(db, tenantId, {
      studentId,
      studentSnapshotId: older,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: root,
    });
    const graded = await insertAttempt(db, tenantId, {
      studentId,
      courseId,
      status: AttemptStatus.Completed,
      gradeScheme: GradeScheme.Letter,
      gradeValue: 'A',
    });
    const newer = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-20T06:00:00.000Z',
      attemptIds: [graded],
    });

    const latestAudit = await audits().findLatest(tenantId, studentId);
    const snapshots = createStudentSnapshotRepository(db);
    const pinned = await snapshots.findById(tenantId, older);
    const latestSnapshot = await snapshots.findLatest(tenantId, studentId);

    expect(latestAudit?.status === 'FOUND' && latestAudit.audit.studentSnapshotId).toBe(older);
    expect(pinned?.attempts.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: enrolled, status: 'IN_PROGRESS' },
    ]);
    expect(latestSnapshot?.status === 'FOUND' && latestSnapshot.revision.snapshot.id).toBe(newer);
  });

  it('picks the newest generation time, not the newest ingestion', async () => {
    const subject = await setUpSubject();
    const base = { studentId: subject.studentId, studentSnapshotId: subject.snapshotId };
    await insertAudit(testDatabase.db, subject.tenantId, {
      ...base,
      auditVersion: 'r2',
      generatedAt: '2026-09-12T06:00:00.000Z',
      ingestedAt: '2026-09-12T07:00:00.000Z',
      requirements: root,
    });
    await insertAudit(testDatabase.db, subject.tenantId, {
      ...base,
      auditVersion: 'r1',
      generatedAt: '2026-09-11T06:00:00.000Z',
      ingestedAt: '2026-09-25T07:00:00.000Z',
      requirements: root,
    });

    expect(await latestVersion(subject)).toBe('r2');
  });

  it('picks the later ingestion at an equal generation time, else reports AMBIGUOUS', async () => {
    const subject = await setUpSubject();
    const base = {
      studentId: subject.studentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: root,
    };
    await insertAudit(testDatabase.db, subject.tenantId, {
      ...base,
      auditVersion: 'r1',
      ingestedAt: '2026-09-11T07:00:00.000Z',
    });
    await insertAudit(testDatabase.db, subject.tenantId, { ...base, auditVersion: 'r2' });
    const beforeTie = await latestVersion(subject);

    await insertAudit(testDatabase.db, subject.tenantId, { ...base, auditVersion: 'r3' });

    expect(beforeTie).toBe('r2');
    expect(await latestVersion(subject)).toEqual({ status: 'AMBIGUOUS' });
  });

  it("does not return another tenant's audit", async () => {
    const subject = await setUpSubject();
    await insertAudit(testDatabase.db, subject.tenantId, {
      studentId: subject.studentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: root,
    });
    const otherTenantId = await insertTenant(testDatabase.db);

    expect(await audits().findLatest(otherTenantId, subject.studentId)).toBeNull();
  });

  it('exposes no method that changes an audit', () => {
    expect(Object.keys(audits())).toEqual(['findLatest']);
  });

  it("can't pin another student's snapshot", async () => {
    const subject = await setUpSubject();
    const otherStudentId = await insertStudent(testDatabase.db, subject.tenantId, 'SYN-0002');

    const insert = insertAudit(testDatabase.db, subject.tenantId, {
      studentId: otherStudentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: root,
    });

    await expect(insert).rejects.toMatchObject(violationOf('audit_snapshot_student_snapshot_fk'));
  });

  it('refuses a parent that is not a requirement of the same audit', async () => {
    const subject = await setUpSubject();

    const insert = insertAudit(testDatabase.db, subject.tenantId, {
      studentId: subject.studentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: [{ sourceRequirementId: 'REQ-MATH', parentSourceRequirementId: 'REQ-CORE' }],
    });

    await expect(insert).rejects.toMatchObject(violationOf('requirement_result_parent_fk'));
  });

  it('fails loudly when stored requirement parents form a cycle', async () => {
    const subject = await setUpSubject();
    await insertAudit(testDatabase.db, subject.tenantId, {
      studentId: subject.studentId,
      studentSnapshotId: subject.snapshotId,
      generatedAt: '2026-09-11T06:00:00.000Z',
      requirements: [
        { sourceRequirementId: 'REQ-A', parentSourceRequirementId: 'REQ-B' },
        { sourceRequirementId: 'REQ-B', parentSourceRequirementId: 'REQ-A' },
      ],
    });

    await expect(audits().findLatest(subject.tenantId, subject.studentId)).rejects.toThrow(
      ZodError,
    );
  });
});
