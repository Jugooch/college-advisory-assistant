/**
 * @file Integration tests for the keys on requirement allocations and candidates (#121): the
 * database refuses an allocated attempt outside the audit's pinned snapshot and a candidate
 * outside the tenant's catalog, and the audit repository reads both lists back in order.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  CourseAttemptId,
  CourseId,
  InstitutionId,
  StudentId,
  StudentSnapshotId,
} from '@caa/domain';

import { requirementResultTable } from '../tables/requirement-result.table';
import { requirementResultAllocatedAttemptTable } from '../tables/requirement-result-allocated-attempt.table';
import { insertCourse, violationOf } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import {
  insertAttempt,
  insertAudit,
  insertSnapshot,
  type RequirementFixture,
} from '../testing/snapshot-fixtures';
import { createAuditSnapshotRepository } from './audit-snapshot.repository';

/** A student with two attempts, each in its own snapshot. */
interface LinkSubject {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly courseIds: readonly [CourseId, CourseId];
  /** Snapshot holding both attempts, in the order `[first, second]`. */
  readonly fullSnapshotId: StudentSnapshotId;
  /** Snapshot holding only `first`. */
  readonly partialSnapshotId: StudentSnapshotId;
  readonly first: CourseAttemptId;
  readonly second: CourseAttemptId;
}

describe('requirement allocation and candidate keys', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const setUp = async (): Promise<LinkSubject> => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const studentId = await insertStudent(db, tenantId, 'SYN-0001');
    const math = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-MATH-101' });
    const chem = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-CHEM-101' });
    const first = await insertAttempt(db, tenantId, { studentId, courseId: math });
    const second = await insertAttempt(db, tenantId, {
      studentId,
      courseId: chem,
      sourceAttemptId: 'SYN-ATT-0002',
    });
    const partialSnapshotId = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
      attemptIds: [first],
    });
    const fullSnapshotId = await insertSnapshot(db, tenantId, {
      studentId,
      sourceEffectiveAt: '2026-09-11T06:00:00.000Z',
      attemptIds: [first, second],
    });
    return {
      tenantId,
      studentId,
      courseIds: [math, chem],
      fullSnapshotId,
      partialSnapshotId,
      first,
      second,
    };
  };

  const audit = (
    subject: LinkSubject,
    studentSnapshotId: StudentSnapshotId,
    requirements: readonly RequirementFixture[],
  ) =>
    insertAudit(testDatabase.db, subject.tenantId, {
      studentId: subject.studentId,
      studentSnapshotId,
      generatedAt: '2026-09-12T06:00:00.000Z',
      requirements,
    });

  it('reads allocations and candidates back in the audit order', async () => {
    const subject = await setUp();
    const [math, chem] = subject.courseIds;
    await audit(subject, subject.fullSnapshotId, [
      {
        sourceRequirementId: 'REQ-CORE',
        allocatedAttemptIds: [subject.second, subject.first],
        candidateCourseIds: [chem, math],
      },
      { sourceRequirementId: 'REQ-ELECTIVE', candidateCourseIds: [math] },
    ]);

    const latest = await createAuditSnapshotRepository(testDatabase.db).findLatest(
      subject.tenantId,
      subject.studentId,
    );

    const requirements = latest?.status === 'FOUND' ? latest.audit.requirements : [];
    expect(
      requirements.map(({ allocatedAttemptIds, candidateCourseIds }) => ({
        allocatedAttemptIds,
        candidateCourseIds,
      })),
    ).toEqual([
      { allocatedAttemptIds: [subject.second, subject.first], candidateCourseIds: [chem, math] },
      { allocatedAttemptIds: [], candidateCourseIds: [math] },
    ]);
  });

  it("refuses an allocated attempt that isn't in the audit's pinned snapshot", async () => {
    const subject = await setUp();

    // NOTE: `second` is the same student's attempt, but only a later snapshot contains it.
    const insert = audit(subject, subject.partialSnapshotId, [
      { sourceRequirementId: 'REQ-CORE', allocatedAttemptIds: [subject.second] },
    ]);

    await expect(insert).rejects.toMatchObject(
      violationOf('requirement_result_allocated_attempt_snapshot_attempt_fk'),
    );
  });

  it('refuses an allocation row that names a snapshot other than the audit pin', async () => {
    const subject = await setUp();
    const auditId = await audit(subject, subject.partialSnapshotId, [
      { sourceRequirementId: 'REQ-CORE' },
    ]);
    const [requirement] = await testDatabase.db
      .select({ id: requirementResultTable.id })
      .from(requirementResultTable)
      .where(
        and(
          eq(requirementResultTable.tenantId, subject.tenantId),
          eq(requirementResultTable.auditSnapshotId, auditId),
        ),
      );

    // NOTE: `second` is in the full snapshot, so only the audit key can refuse this row.
    const insert = testDatabase.db.insert(requirementResultAllocatedAttemptTable).values({
      tenantId: subject.tenantId,
      auditSnapshotId: auditId,
      requirementResultId: requirement?.id ?? '',
      studentSnapshotId: subject.fullSnapshotId,
      courseAttemptId: subject.second,
      position: 0,
    });

    await expect(insert).rejects.toMatchObject(
      violationOf('requirement_result_allocated_attempt_audit_fk'),
    );
  });

  it('refuses the same attempt allocated twice to one requirement', async () => {
    const subject = await setUp();

    const insert = audit(subject, subject.fullSnapshotId, [
      { sourceRequirementId: 'REQ-CORE', allocatedAttemptIds: [subject.first, subject.first] },
    ]);

    await expect(insert).rejects.toMatchObject(
      violationOf('requirement_result_allocated_attempt_pkey'),
    );
  });

  it("refuses a candidate course from another tenant's catalog", async () => {
    const subject = await setUp();
    const otherTenantId = await insertTenant(testDatabase.db);
    const foreignCourse = await insertCourse(testDatabase.db, otherTenantId);

    const insert = audit(subject, subject.fullSnapshotId, [
      { sourceRequirementId: 'REQ-CORE', candidateCourseIds: [foreignCourse] },
    ]);

    await expect(insert).rejects.toMatchObject(
      violationOf('requirement_result_candidate_course_course_fk'),
    );
  });

  it('refuses a candidate course that is in no catalog', async () => {
    const subject = await setUp();

    const insert = audit(subject, subject.fullSnapshotId, [
      {
        sourceRequirementId: 'REQ-CORE',
        candidateCourseIds: ['6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d'],
      },
    ]);

    await expect(insert).rejects.toMatchObject(
      violationOf('requirement_result_candidate_course_course_fk'),
    );
  });
});
