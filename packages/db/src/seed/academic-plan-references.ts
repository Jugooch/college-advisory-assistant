/**
 * @file Checks that every reference inside the academic seed plan resolves within the plan,
 *   before anything is written.
 * @module @caa/db/seed/academic-plan-references
 * @requirement FR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { type PrerequisiteExpression, PrerequisiteExpressionType } from '@caa/domain';

import type { DevSeedAcademicPlan } from './dev-seed-academic-plan';

/** Thrown when the academic seed plan refers to something it doesn't contain. */
export class AcademicSeedReferenceError extends Error {
  /**
   * Creates the error.
   *
   * @param problem - Which kind of reference failed; names record kinds, never values.
   */
  constructor(problem: string) {
    super(`Academic seed plan is inconsistent: ${problem}`);
    this.name = 'AcademicSeedReferenceError';
  }
}

/**
 * Lists every course a prerequisite expression names, at any depth.
 *
 * @param expression - The expression tree.
 * @returns Course IDs in tree order, possibly repeated.
 */
function coursesIn(expression: PrerequisiteExpression): readonly string[] {
  switch (expression.type) {
    case PrerequisiteExpressionType.All:
    case PrerequisiteExpressionType.Any:
      return expression.items.flatMap(coursesIn);
    case PrerequisiteExpressionType.Course:
      return [expression.courseId];
    case PrerequisiteExpressionType.Unsupported:
      return [];
  }
}

/**
 * Throws unless every value is in the allowed set.
 *
 * @param values - Values to check.
 * @param allowed - Values that resolve.
 * @param problem - Description used in the error.
 * @throws {AcademicSeedReferenceError} When a value is not in `allowed`.
 */
function requireAll(values: Iterable<string>, allowed: ReadonlySet<string>, problem: string): void {
  for (const value of values) {
    if (!allowed.has(value)) {
      throw new AcademicSeedReferenceError(problem);
    }
  }
}

/**
 * Checks the plan's internal references: one tenant throughout; rule, attempt, and requirement
 * courses in the catalog; attempt terms in the calendar; snapshot attempts belonging to the
 * snapshot's student; and each audit pinned to its own student's snapshot, allocating only that
 * snapshot's attempts.
 *
 * @param plan - The academic seed plan.
 * @throws {AcademicSeedReferenceError} When any reference doesn't resolve within the plan.
 */
export function assertAcademicPlanReferences(plan: DevSeedAcademicPlan): void {
  const records: readonly { readonly tenantId: string }[] = [
    ...plan.courses,
    ...plan.rules,
    ...plan.terms,
    ...plan.attempts,
    ...plan.snapshots,
    ...plan.audits,
  ];
  const tenantIds = new Set(records.map((record) => record.tenantId));
  requireAll(tenantIds, new Set([plan.policy.tenantId]), 'records span more than one tenant');

  const courseIds = new Set(plan.courses.map((course) => course.id));
  // SAFETY: a rule naming a course outside the catalog would reach the engine as an unknown
  // course; the #115 decision is to refuse it on write.
  requireAll(
    plan.rules.flatMap((rule) => [rule.courseId, ...coursesIn(rule.expression)]),
    courseIds,
    'a prerequisite rule names a course that is not in the catalog',
  );
  requireAll(
    plan.attempts.map((attempt) => attempt.courseId),
    courseIds,
    'an attempt is for a course that is not in the catalog',
  );
  requireAll(
    plan.attempts.map((attempt) => attempt.termCode),
    new Set(plan.terms.map((term) => term.termCode)),
    'an attempt is in a term that is not in the calendar',
  );

  for (const snapshot of plan.snapshots) {
    const ownAttempts = plan.attempts.filter((attempt) => attempt.studentId === snapshot.studentId);
    requireAll(
      snapshot.attemptIds,
      new Set(ownAttempts.map((attempt) => attempt.id)),
      "a snapshot lists an attempt that is not its student's",
    );
  }

  for (const audit of plan.audits) {
    const pinned = plan.snapshots.find(
      (snapshot) =>
        snapshot.id === audit.studentSnapshotId && snapshot.studentId === audit.studentId,
    );
    if (!pinned) {
      throw new AcademicSeedReferenceError("an audit is not pinned to its student's snapshot");
    }
    const requirements = audit.requirements;
    requireAll(
      requirements.flatMap((requirement) => requirement.allocatedAttemptIds),
      new Set(pinned.attemptIds),
      'an audit allocates an attempt that is not in its pinned snapshot',
    );
    requireAll(
      requirements.flatMap((requirement) => requirement.candidateCourseIds),
      courseIds,
      'an audit names a candidate course that is not in the catalog',
    );
  }
}
