/**
 * @file Checks whether candidate courses compete for requirements the audit must allocate among them.
 * @module @caa/engine/verification/check-allocation
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AuditSnapshot,
  CheckKind,
  type CheckResult,
  CheckState,
  type CourseId,
  createCheckResult,
  ReasonCode,
  RequirementState,
} from '@caa/domain';

import { assertValidCandidateSet, type CourseSelection } from './candidate-set';
import {
  checkAuditReflectsRecord,
  type StudentRecordFreshness,
} from './check-audit-reflects-record';
import { type AllocationContest, findAllocationContests } from './find-allocation-contests';

/**
 * Checks a candidate set for courses that compete for audit requirements.
 *
 * The audit owns allocation, so the engine never chooses where a course counts. It reports a
 * requirement as contested when it can't prove that every allocation the audit may choose
 * leaves each candidate counted without exceeding a requirement or reusing a course (see
 * `findAllocationContests`). Then:
 * 1. The audit is stale for the student record (see `checkAuditReflectsRecord`): one UNKNOWN
 *    check (`AUDIT_STALE`) naming every candidate.
 * 2. Some requirement is contested: one UNKNOWN check per contested requirement, in audit order,
 *    naming its competing courses. The reason is `AUDIT_AMBIGUOUS` when the requirement is
 *    decided AMBIGUOUS (by itself or an ancestor) and `ALLOCATION_CONFLICT` otherwise.
 * 3. Otherwise one PASS check naming every candidate. PASS says only that no candidates were
 *    found to compete; whether each course applies at all is `evaluateApplicability`'s check.
 *
 * The same inputs always give a deep-equal result.
 *
 * @param candidates - The candidate set. Credits are used as upper bounds for credit room.
 * @param audit - The authoritative audit snapshot.
 * @param freshness - The student record the audit must reflect and the maximum skew allowed.
 * @returns REQUIREMENT_ALLOCATION checks. Each `sourceRef` pins the audit revision as
 *   `<auditSource>:<auditVersion>`, followed by `:<requirement sourceRef>` for a contested
 *   requirement (or the ancestor that decided it AMBIGUOUS). Evidence has no ruleset version
 *   and no decisive leaves; `courseIds` are in candidate-set order.
 * @throws {CandidateSetInputError} When the candidate set is malformed (see
 *   `assertValidCandidateSet`).
 * @throws {AuditRecordInputError} When a timestamp or the maximum skew is invalid.
 */
export function checkAllocation(
  candidates: readonly CourseSelection[],
  audit: AuditSnapshot,
  freshness: StudentRecordFreshness,
): readonly CheckResult[] {
  assertValidCandidateSet(candidates);
  const auditRef = `${audit.auditSource}:${audit.auditVersion}`;
  const allCourseIds = candidates.map((candidate) => candidate.course.id);
  const reflection = checkAuditReflectsRecord(
    audit,
    freshness.studentRecordEffectiveAt,
    freshness.maxSkewMs,
  );
  // SAFETY: a stale audit can't say which requirements are still open or how much room they
  // have, so none of its allocation data is read and nothing passes (planning/07 §Consistency
  // model; AC10).
  if (reflection.state !== CheckState.Pass) {
    return [toCheck(ReasonCode.AuditStale, auditRef, allCourseIds)];
  }
  const contests = findAllocationContests(candidates, audit);
  if (contests.length === 0) {
    return [toCheck(null, auditRef, allCourseIds)];
  }
  // SAFETY: a contested requirement is UNKNOWN, never PASS for each competing course, so a
  // plan never shows two courses, or two requirements, as satisfied by what the audit counts
  // once (planning/08 §Candidate formation and allocation; AC05). It isn't FAIL either: the
  // audit may still count every course somewhere, which only it can say.
  return contests.map((contest) => toContestCheck(contest, auditRef));
}

/**
 * Builds the check for one contested requirement.
 *
 * @param contest - The contested requirement and its competing courses.
 * @param auditRef - The pinned audit revision.
 * @returns An UNKNOWN check naming the requirement and the courses.
 */
function toContestCheck(contest: AllocationContest, auditRef: string): CheckResult {
  const { requirement, deciding, courseIds } = contest;
  // SAFETY: an unsettled requirement or ancestor is reported as the audit's ambiguity, naming
  // the requirement that decided it, so the referral goes to the right place (planning/08
  // §Authority and result semantics).
  if (deciding.state === RequirementState.Ambiguous) {
    return toCheck(
      ReasonCode.AuditAmbiguous,
      `${auditRef}:${deciding.requirement.sourceRef}`,
      courseIds,
    );
  }
  return toCheck(ReasonCode.AllocationConflict, `${auditRef}:${requirement.sourceRef}`, courseIds);
}

/**
 * Builds an allocation check.
 *
 * @param reasonCode - Why the check is UNKNOWN, or `null` for PASS.
 * @param sourceRef - The audit revision, and the requirement if one is named.
 * @param courseIds - The courses the check is about.
 * @returns The validated check.
 */
function toCheck(
  reasonCode: ReasonCode | null,
  sourceRef: string,
  courseIds: readonly CourseId[],
): CheckResult {
  return createCheckResult({
    kind: CheckKind.RequirementAllocation,
    sourceRef,
    ...(reasonCode === null
      ? { state: CheckState.Pass }
      : { state: CheckState.Unknown, reasonCode }),
    evidence: { rulesetVersion: null, decisiveLeaves: [], courseIds },
  });
}
