/**
 * @file Error thrown when scheduling input is malformed, instead of guessing what the caller meant.
 * @module @caa/engine/scheduling/schedule-input-error
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */

/**
 * What is wrong with scheduling input.
 * - `sameSection`: a section was compared with itself.
 * - `tenantMismatch`: sections or the transition table belong to different tenants.
 * - `linkCycle`: linked-section groups require each other in a cycle.
 * - `courseMissing`: a bundle's section belongs to a course the caller didn't supply.
 */
export type ScheduleInputIssue = 'sameSection' | 'tenantMismatch' | 'linkCycle' | 'courseMissing';

/** Thrown when scheduling input is malformed, instead of guessing. */
export class ScheduleInputError extends Error {
  /** The input problem, for callers that map it to a response. */
  readonly issue: ScheduleInputIssue;

  /**
   * Creates the error.
   *
   * @param issue - What is wrong with the input.
   */
  constructor(issue: ScheduleInputIssue) {
    super(`Schedule input is invalid: ${issue}`);
    this.name = 'ScheduleInputError';
    this.issue = issue;
  }
}
