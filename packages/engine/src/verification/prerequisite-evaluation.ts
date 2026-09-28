/**
 * @file Input record of prerequisite evaluation and the error for mismatched rule and policy.
 * @module @caa/engine/verification/prerequisite-evaluation
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { Course, CourseAttempt } from '@caa/domain';

/** The student's attempts and the catalog that covers them. */
export interface StudentCourseRecord {
  readonly attempts: readonly CourseAttempt[];
  /** Catalog courses; used to find each required course's equivalency group. */
  readonly courses: readonly Course[];
}

/** Thrown when the rule and the academic policy belong to different tenants or rulesets. */
export class PrerequisiteInputMismatchError extends Error {
  /**
   * Creates the error.
   *
   * @param field - The field that differs, `tenantId` or `rulesetVersion`.
   */
  constructor(field: 'tenantId' | 'rulesetVersion') {
    super(`Prerequisite rule and academic policy have different ${field} values`);
    this.name = 'PrerequisiteInputMismatchError';
  }
}
