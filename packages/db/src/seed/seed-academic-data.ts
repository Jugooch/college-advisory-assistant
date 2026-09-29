/**
 * @file Writes the academic seed plan: catalog, rules, policy, terms, snapshots with attempts,
 *   and audits with requirements. Insert-only and idempotent.
 * @module @caa/db/seed/seed-academic-data
 * @requirement FR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { AuditSnapshot, StudentSnapshot } from '@caa/domain';

import type { Database } from '../client';
import { academicPolicyTable } from '../tables/academic-policy.table';
import { auditSnapshotTable } from '../tables/audit-snapshot.table';
import { courseTable } from '../tables/course.table';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { prerequisiteRuleTable } from '../tables/prerequisite-rule.table';
import { requirementResultTable } from '../tables/requirement-result.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';
import { termTable } from '../tables/term.table';
import { assertAcademicPlanReferences } from './academic-plan-references';
import type { DevSeedAcademicPlan } from './dev-seed-academic-plan';

/** How many academic records the plan holds. Counts only, safe to log. */
export interface AcademicSeedCounts {
  readonly courses: number;
  readonly prerequisiteRules: number;
  readonly academicPolicies: number;
  readonly terms: number;
  readonly courseAttempts: number;
  readonly studentSnapshots: number;
  readonly auditSnapshots: number;
}

/** The part of a database handle or transaction the seed writes through. */
type SeedWriter = Pick<Database, 'insert'>;

/** Resolves a plan student ID to the ID of the stored student row. */
type ResolveStudentId = (planStudentId: string) => string;

// NOTE: every insert below ignores a conflict on the row's own key, and nothing is updated,
// because seeded revisions are immutable. The catalog, rules, policy, terms, and attempts have
// fixed IDs, so a re-run leaves them as they are. Each run's snapshots and audits have IDs and
// audit versions derived from the run time, so a later run adds a fresh revision of each, which
// "latest" then picks, and a run with the same time writes nothing new. A row that clashes on
// another key (for example a term code under a different ID) makes the seed fail instead of being
// overwritten. Changes to the fixed records need a database reset.

/**
 * Writes the catalog, rules, policy, and terms.
 *
 * @param tx - Open transaction.
 * @param plan - The academic plan.
 */
async function insertCatalogAndPolicy(tx: SeedWriter, plan: DevSeedAcademicPlan): Promise<void> {
  await tx
    .insert(courseTable)
    .values(plan.courses.map((course) => ({ ...course })))
    .onConflictDoNothing({ target: courseTable.id });
  await tx
    .insert(prerequisiteRuleTable)
    .values(plan.rules.map((rule) => ({ ...rule })))
    .onConflictDoNothing({
      target: [
        prerequisiteRuleTable.tenantId,
        prerequisiteRuleTable.courseId,
        prerequisiteRuleTable.rulesetVersion,
      ],
    });
  const { termCreditBounds, letterGradeOrder, ...policy } = plan.policy;
  await tx
    .insert(academicPolicyTable)
    .values({
      ...policy,
      letterGradeOrder: [...letterGradeOrder],
      termMinCreditsHundredths: termCreditBounds?.minCreditsHundredths ?? null,
      termMaxCreditsHundredths: termCreditBounds?.maxCreditsHundredths ?? null,
    })
    .onConflictDoNothing({
      target: [academicPolicyTable.tenantId, academicPolicyTable.rulesetVersion],
    });
  await tx
    .insert(termTable)
    .values(plan.terms.map((term) => ({ ...term })))
    .onConflictDoNothing({ target: termTable.id });
}

/**
 * Writes attempts, then each snapshot with its attempt links in order.
 *
 * @param tx - Open transaction.
 * @param plan - The academic plan.
 * @param resolveStudentId - Maps plan student IDs to stored ones.
 */
async function insertRecords(
  tx: SeedWriter,
  plan: DevSeedAcademicPlan,
  resolveStudentId: ResolveStudentId,
): Promise<void> {
  await tx
    .insert(courseAttemptTable)
    .values(
      plan.attempts.map(({ grade, ...attempt }) => ({
        ...attempt,
        studentId: resolveStudentId(attempt.studentId),
        gradeScheme: grade?.scheme ?? null,
        gradeValue: grade?.value ?? null,
      })),
    )
    .onConflictDoNothing({ target: courseAttemptTable.id });
  for (const snapshot of plan.snapshots) {
    await insertSnapshot(tx, snapshot, resolveStudentId(snapshot.studentId));
  }
}

/**
 * Writes one snapshot and its attempt links.
 *
 * @param tx - Open transaction.
 * @param snapshot - The snapshot.
 * @param studentId - Stored ID of its student.
 */
async function insertSnapshot(
  tx: SeedWriter,
  snapshot: StudentSnapshot,
  studentId: string,
): Promise<void> {
  await tx
    .insert(studentSnapshotTable)
    .values({
      ...snapshot,
      studentId,
      sourceEffectiveAt: new Date(snapshot.sourceEffectiveAt),
      ingestedAt: new Date(snapshot.ingestedAt),
    })
    .onConflictDoNothing({ target: studentSnapshotTable.id });
  if (snapshot.attemptIds.length === 0) {
    return;
  }
  const links = studentSnapshotAttemptTable;
  await tx
    .insert(links)
    .values(
      snapshot.attemptIds.map((courseAttemptId, position) => ({
        tenantId: snapshot.tenantId,
        studentId,
        studentSnapshotId: snapshot.id,
        courseAttemptId,
        position,
      })),
    )
    .onConflictDoNothing({
      target: [links.tenantId, links.studentSnapshotId, links.courseAttemptId],
    });
}

/**
 * Writes one audit and its requirements in audit order.
 *
 * @param tx - Open transaction.
 * @param audit - The audit.
 * @param studentId - Stored ID of its student.
 */
async function insertAudit(tx: SeedWriter, audit: AuditSnapshot, studentId: string): Promise<void> {
  const { requirements, ...fields } = audit;
  await tx
    .insert(auditSnapshotTable)
    .values({
      ...fields,
      studentId,
      generatedAt: new Date(audit.generatedAt),
      studentRecordEffectiveAt: new Date(audit.studentRecordEffectiveAt),
    })
    .onConflictDoNothing({ target: auditSnapshotTable.id });
  const results = requirementResultTable;
  await tx
    .insert(results)
    .values(
      requirements.map((requirement, position) => ({
        ...requirement,
        tenantId: audit.tenantId,
        auditSnapshotId: audit.id,
        position,
        allocatedAttemptIds: [...requirement.allocatedAttemptIds],
        candidateCourseIds: [...requirement.candidateCourseIds],
      })),
    )
    .onConflictDoNothing({
      target: [results.tenantId, results.auditSnapshotId, results.sourceRequirementId],
    });
}

/**
 * Checks the plan's references, then writes it inside the caller's transaction.
 *
 * @param tx - Open transaction.
 * @param plan - The academic plan.
 * @param resolveStudentId - Maps plan student IDs to stored ones.
 * @returns How many records of each kind the plan holds.
 * @throws {AcademicSeedReferenceError} When the plan refers to something it doesn't contain;
 *   nothing is written.
 */
export async function seedAcademicData(
  tx: SeedWriter,
  plan: DevSeedAcademicPlan,
  resolveStudentId: ResolveStudentId,
): Promise<AcademicSeedCounts> {
  assertAcademicPlanReferences(plan);
  await insertCatalogAndPolicy(tx, plan);
  await insertRecords(tx, plan, resolveStudentId);
  for (const audit of plan.audits) {
    await insertAudit(tx, audit, resolveStudentId(audit.studentId));
  }
  return {
    courses: plan.courses.length,
    prerequisiteRules: plan.rules.length,
    academicPolicies: 1,
    terms: plan.terms.length,
    courseAttempts: plan.attempts.length,
    studentSnapshots: plan.snapshots.length,
    auditSnapshots: plan.audits.length,
  };
}
