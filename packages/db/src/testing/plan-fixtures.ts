/**
 * @file Synthetic plan worlds and revisions for repository integration tests. Test code only;
 *   every value is fictional. The shared test-kit builders (`buildPlan`, `buildPlanRevision`)
 *   are not on main yet, so this file builds the db-shaped input itself.
 * @module @caa/db/testing/plan-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  type AuditSnapshotId,
  ConstraintStrength,
  type CourseId,
  type InstitutionId,
  PlanRevisionCause,
  ScheduleConstraintKind,
  ScheduleOutcome,
  type SectionId,
  SectionIdSchema,
  type SectionSnapshotId,
  type StudentId,
  type StudentSnapshotId,
  type TermId,
  type UserId,
} from '@caa/domain';

import type { Database } from '../client';
import type { NewPlanRevision } from '../repositories/plan.repository';
import { insertCourse } from './catalog-fixtures';
import { insertStudent, insertUser } from './integration-fixtures';
import { insertSectionWorld, publishSectionSnapshot } from './section-fixtures';
import { insertAudit, insertSnapshot } from './snapshot-fixtures';

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
  const studentId = await insertStudent(db, tenantId, `SYN-${label}`);
  const userId = await insertUser(db, tenantId, label);
  const sections = await insertSectionWorld(db, tenantId);
  const sectionSnapshot = await publishSectionSnapshot(db, sections);
  const studentSnapshotId = await insertSnapshot(db, tenantId, {
    studentId,
    sourceEffectiveAt: '2026-09-10T06:00:00.000Z',
  });
  const auditSnapshotId = await insertAudit(db, tenantId, {
    studentId,
    studentSnapshotId,
    generatedAt: '2026-09-11T06:00:00.000Z',
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

/**
 * Builds a valid revision for the world, with an `OPTIONS_FOUND` result.
 *
 * @param world - The records to pin.
 * @param overrides - Fields to change.
 * @returns The revision content.
 */
export function buildNewRevision(
  world: PlanWorld,
  overrides: Partial<NewPlanRevision> = {},
): NewPlanRevision {
  return {
    cause: PlanRevisionCause.Saved,
    createdBy: world.userId,
    createdAt: '2026-10-01T15:00:00.000Z',
    termId: world.termId,
    courseIds: [world.courseId],
    creditSelections: [],
    constraints: [
      {
        kind: ScheduleConstraintKind.CreditRange,
        strength: ConstraintStrength.Hard,
        priorityRank: null,
        minCreditsHundredths: 900,
        maxCreditsHundredths: 1500,
      },
    ],
    studentSnapshotId: world.studentSnapshotId,
    studentRecordEffectiveAt: '2026-09-10T06:00:00.000Z',
    auditRecordEffectiveAt: '2026-09-11T06:00:00.000Z',
    auditSnapshotId: world.auditSnapshotId,
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r1',
    rulesetVersion: 'demo-ruleset-1',
    sectionSnapshotId: world.sectionSnapshotId,
    campusTransitionVersion: null,
    solverWorkCap: 3_000_000,
    constraintHash: `sha256:${'a'.repeat(64)}`,
    outcome: ScheduleOutcome.OptionsFound,
    selectedSectionIds: [world.sectionId],
    result: { outcome: 'OPTIONS_FOUND', options: [{ note: 'opaque to the db' }] },
    ...overrides,
  };
}
