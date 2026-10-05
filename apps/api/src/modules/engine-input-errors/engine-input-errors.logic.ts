/**
 * @file Decides whether an engine input error was caused by the request, by stored source data,
 * or by an internal defect, so each maps to an honest response. Pure logic (standard 05 §Logic).
 * @module @caa/api/modules/engine-input-errors/engine-input-errors.logic
 * @requirement FR-09
 * @requirement NFR-04
 * @see docs/standards/09-errors-logging-and-security.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  AuditRecordInputError,
  CandidateSetInputError,
  type CandidateSetInputIssue,
  PrerequisiteInputMismatchError,
} from '@caa/engine';

import { CreditInclusionUnknownError } from '../course-verification/course-verification.logic';

/**
 * Who caused an engine input error:
 * - `REQUEST`: the caller sent something that can't be checked. 400 INVALID_REQUEST.
 * - `STORED_DATA`: a stored source record (catalog, policy, snapshot, audit) is unusable, and
 *   the caller did nothing wrong. 503 SOURCE_UNAVAILABLE with an advisor referral.
 * - `INTERNAL`: the loaded inputs contradict how they were queried, which is a defect in this
 *   service or its repositories, not a source gap. 500 INTERNAL_ERROR.
 */
export type EngineInputErrorCause = 'REQUEST' | 'STORED_DATA' | 'INTERNAL';

/** The cause of an engine input error, and an opaque reason for the log line. */
export interface EngineInputErrorClassification {
  readonly cause: EngineInputErrorCause;
  /** The error name, and its issue when the engine exposes one, e.g. `CandidateSetInputError:bounds`. */
  readonly reason: string;
}

/**
 * The cause of each candidate set issue. Course IDs and credit choices are the only request
 * inputs; credit ranges come from the catalog and credit bounds from the academic policy.
 */
const CAUSE_BY_CANDIDATE_ISSUE: Readonly<Record<CandidateSetInputIssue, EngineInputErrorCause>> = {
  // The request named a course twice.
  duplicateCourse: 'REQUEST',
  // The request named two courses of one equivalency group.
  equivalentCourses: 'REQUEST',
  // The request chose credits outside the course's catalog range.
  selectedCredits: 'REQUEST',
  // A stored variable-credit course has no credit range.
  courseCredits: 'STORED_DATA',
  // The stored policy's term credit bounds are negative, fractional, or inverted.
  bounds: 'STORED_DATA',
  // Chosen credits are capped by catalog ranges, so only stored credit values can overflow.
  totalCredits: 'STORED_DATA',
};

/**
 * Classifies an error thrown by the engine's course-set checks, or by `verifyCourseSet` when it
 * builds their inputs.
 *
 * @param error - Anything `verifyCourseSet` threw.
 * @returns The cause and log reason, or `null` when the error isn't an engine input error (the
 *   caller rethrows it unchanged).
 */
export function classifyEngineInputError(error: unknown): EngineInputErrorClassification | null {
  if (error instanceof CandidateSetInputError) {
    return {
      cause: CAUSE_BY_CANDIDATE_ISSUE[error.issue],
      reason: `${error.name}:${error.issue}`,
    };
  }
  if (error instanceof AuditRecordInputError) {
    // NOTE: the inputs are the stored snapshot and audit timestamps and the skew. The skew is
    // validated at startup (`AUDIT_RECORD_MAX_SKEW_MS`), so the reachable cause is a stored
    // timestamp without an offset.
    return { cause: 'STORED_DATA', reason: error.name };
  }
  if (error instanceof CreditInclusionUnknownError) {
    // SAFETY: whether a course's credits are included in another comes from the stored catalog,
    // so an omitted link is a source gap the student is referred on, never a request error.
    return { cause: 'STORED_DATA', reason: error.name };
  }
  if (error instanceof PrerequisiteInputMismatchError) {
    // SAFETY: the rule and the policy are both loaded for the session's tenant at one ruleset
    // version, so a mismatch means a repository returned out-of-scope data. That is a defect
    // to fix, never shown to the student as a source gap.
    return { cause: 'INTERNAL', reason: error.name };
  }
  return null;
}
