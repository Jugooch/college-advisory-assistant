/**
 * @file Synthetic plan worlds and revisions for repository integration tests. Test code only;
 *   every value is fictional. Revisions come from the shared test-kit `buildPlanRevision`,
 *   pinned to the real rows inserted here.
 * @module @caa/db/testing/plan-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  type AuditSnapshotId,
  type CourseId,
  type InstitutionId,
  type PlanRevisionInput,
  type SectionId,
  SectionIdSchema,
  type SectionSnapshot,
  type SectionSnapshotId,
  type StudentId,
  type StudentSnapshotId,
  type TermId,
  type UserId,
} from '@caa/domain';
import { buildPlanRevision } from '@caa/test-kit';

import type { Database } from '../client';
import type { NewPlanRevision } from '../repositories/plan.repository';
import { insertCourse } from './catalog-fixtures';
import { insertStudent, insertUser } from './integration-fixtures';
import { insertSectionWorld, publishSectionSnapshot, type SectionWorld } from './section-fixtures';
import { insertAudit, insertSnapshot } from './snapshot-fixtures';

/** The student record time the fixture snapshot describes. */
const STUDENT_RECORD_AT = '2026-09-10T06:00:00.000Z';
/** The time the fixture audit was generated, which is also its record time. */
const AUDIT_RECORD_AT = '2026-09-11T06:00:00.000Z';

/** One tenant's student with every record a plan revision pins. */
export interface PlanWorld {
  readonly tenantId: InstitutionId;
  readonly studentId: StudentId;
  readonly termId: TermId;
  readonly userId: UserId;
  readonly courseId: CourseId;
  readonly studentSnapshotId: StudentSnapshotId;
  readonly auditSnapshotId: AuditSnapshotId;
  readonly sectionSnapshotId: SectionSnapshotId;
  readonly sectionId: SectionId;
}

/** A tenant's term and published section snapshot, which several worlds in one tenant share. */
export interface SharedSections {
  readonly sections: SectionWorld;
  readonly sectionSnapshot: SectionSnapshot;
}

/**
 * Inserts a tenant's term, courses and published section snapshot, for worlds that share them.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @returns The shared term and snapshot.
 */
export async function insertSharedSections(
  db: Database,
  tenantId: InstitutionId,
): Promise<SharedSections> {
  const sections = await insertSectionWorld(db, tenantId);
  return { sections, sectionSnapshot: await publishSectionSnapshot(db, sections) };
}

/**
 * Inserts a tenant's student, term, user, snapshots and audit for plan tests.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param label - Distinguishes worlds in one tenant.
 * @returns The IDs a revision can pin.
 */
export async function insertPlanWorld(
  db: Database,
  tenantId: InstitutionId,
  label: string,
): Promise<PlanWorld> {
  return insertPlanWorldIn(db, await insertSharedSections(db, tenantId), label);
}

/**
 * Inserts a student, user, snapshots and audit in a tenant that already has its term and
 * section snapshot. A tenant has one term, so a second world in it must use this.
 *
 * @param db - Database handle.
 * @param shared - The tenant's shared term and section snapshot.
 * @param label - Distinguishes worlds in one tenant.
 * @returns The IDs a revision can pin.
 */
export async function insertPlanWorldIn(
  db: Database,
  shared: SharedSections,
  label: string,
): Promise<PlanWorld> {
  const { sections, sectionSnapshot } = shared;
  const tenantId = sections.tenantId;
  const studentId = await insertStudent(db, tenantId, `SYN-${label}`);
  const userId = await insertUser(db, tenantId, label);
  const studentSnapshotId = await insertSnapshot(db, tenantId, {
    studentId,
    sourceEffectiveAt: STUDENT_RECORD_AT,
  });
  const auditSnapshotId = await insertAudit(db, tenantId, {
    studentId,
    studentSnapshotId,
    generatedAt: AUDIT_RECORD_AT,
    requirements: [{ sourceRequirementId: 'REQ-ROOT' }],
  });
  const courseId = await insertCourse(db, tenantId, { sourceCourseId: `DEMO-PLAN-${label}` });
  const sectionId = SectionIdSchema.parse(sectionSnapshot.sections[0]?.id);
  return {
    tenantId,
    studentId,
    termId: sections.termId,
    userId,
    courseId,
    studentSnapshotId,
    auditSnapshotId,
    sectionSnapshotId: sectionSnapshot.id,
    sectionId,
  };
}

/** Fields a test may change on the revision built for a {@link PlanWorld}. */
type RevisionOverrides = Partial<PlanRevisionInput> & { readonly result?: unknown };

/**
 * Builds a valid revision for the world from the shared test-kit builder, pinned to the
 * world's real rows, with an `OPTIONS_FOUND` result.
 *
 * @param world - The records to pin.
 * @param overrides - Fields to change.
 * @returns The revision content.
 */
export function buildNewRevision(
  world: PlanWorld,
  overrides: RevisionOverrides = {},
): NewPlanRevision {
  const { result, ...revisionOverrides } = overrides;
  const built = buildPlanRevision({
    createdBy: world.userId,
    termId: world.termId,
    courseIds: [world.courseId],
    studentSnapshotId: world.studentSnapshotId,
    studentRecordEffectiveAt: STUDENT_RECORD_AT,
    auditSnapshotId: world.auditSnapshotId,
    auditRecordEffectiveAt: AUDIT_RECORD_AT,
    sectionSnapshotId: world.sectionSnapshotId,
    selectedSectionIds: [world.sectionId],
    ...revisionOverrides,
  });
  return {
    cause: built.cause,
    createdBy: built.createdBy,
    createdAt: built.createdAt,
    termId: built.termId,
    courseIds: built.courseIds,
    creditSelections: built.creditSelections,
    constraints: built.constraints,
    studentSnapshotId: built.studentSnapshotId,
    studentRecordEffectiveAt: built.studentRecordEffectiveAt,
    auditRecordEffectiveAt: built.auditRecordEffectiveAt,
    auditSnapshotId: built.auditSnapshotId,
    auditSource: built.auditSource,
    auditVersion: built.auditVersion,
    rulesetVersion: built.rulesetVersion,
    sectionSnapshotId: built.sectionSnapshotId,
    campusTransitionVersion: built.campusTransitionVersion,
    solverWorkCap: built.solverWorkCap,
    constraintHash: built.constraintHash,
    outcome: built.outcome,
    selectedSectionIds: built.selectedSectionIds,
    result: result ?? { outcome: built.outcome, options: [{ note: 'opaque to the db' }] },
  };
}
