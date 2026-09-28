/**
 * @file Decides from the authoritative audit whether a course applies to an outstanding requirement.
 * @module @caa/engine/verification/evaluate-applicability
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
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

import {
  checkAuditReflectsRecord,
  type StudentRecordFreshness,
} from './check-audit-reflects-record';
import { createDecidingRequirementLookup } from './find-deciding-requirement';

/** The applicability a requirement in one audit state gives a course it lists as a candidate. */
interface RequirementOutcome {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

// SAFETY: a candidate is decided by the audit's own states for it and its ancestors (see
// find-deciding-requirement.ts), never by its children's, so a parent is never treated as
// satisfied from partial children (requirement-result.model.ts; planning/08 §Authority and
// result semantics: the audit owns allocation).
const OUTCOME_BY_REQUIREMENT_STATE: Readonly<Record<RequirementState, RequirementOutcome>> = {
  [RequirementState.Incomplete]: { state: CheckState.Pass, reasonCode: null },
  // SAFETY: an IN_PROGRESS requirement is satisfied if its in-progress attempts finish as
  // required, and then the course adds nothing. The course applies only if they don't, so the
  // result is CONDITIONAL on in-progress outcomes, never PASS (requirement-state.enum.ts;
  // planning/08 §Eligibility semantics: in-progress work is conditional).
  [RequirementState.InProgress]: {
    state: CheckState.Conditional,
    reasonCode: ReasonCode.RequirementInProgress,
  },
  [RequirementState.Complete]: {
    state: CheckState.Fail,
    reasonCode: ReasonCode.RequirementAlreadySatisfied,
  },
  // SAFETY: an audit that doesn't settle a requirement can't show the course applies to it
  // (planning/08 §Authority and result semantics: unsettled authority is UNKNOWN).
  [RequirementState.Ambiguous]: {
    state: CheckState.Unknown,
    reasonCode: ReasonCode.AuditAmbiguous,
  },
};

// SAFETY: when a course is a candidate for several requirements, AMBIGUOUS wins over every
// other state. The audit, not the engine, decides where a course is allocated, and candidates
// can compete for one bucket (planning/08 §Candidate formation), so an unsettled requirement
// could take the course from an outstanding one; a PASS elsewhere must not hide that. After
// that, the course applies if it applies anywhere: an outstanding requirement (PASS) beats an
// in-progress one (CONDITIONAL), which beats one already satisfied (FAIL).
const REQUIREMENT_STATE_PRECEDENCE: readonly RequirementState[] = [
  RequirementState.Ambiguous,
  RequirementState.Incomplete,
  RequirementState.InProgress,
  RequirementState.Complete,
];

/**
 * Decides whether the audit lists a course as applying to an outstanding requirement.
 *
 * Each requirement listing the course is decided by the most settled state among itself and
 * its ancestors (AMBIGUOUS, then COMPLETE, then IN_PROGRESS, then INCOMPLETE; see
 * `createDecidingRequirementLookup`), naming the nearest requirement with that state. Then:
 * 1. The audit is stale for the student record (see `checkAuditReflectsRecord`): UNKNOWN
 *    (`AUDIT_STALE`), whatever the requirements say.
 * 2. Some candidate is decided AMBIGUOUS: UNKNOWN (`AUDIT_AMBIGUOUS`).
 * 3. Some candidate is decided INCOMPLETE: PASS.
 * 4. Some candidate is decided IN_PROGRESS: CONDITIONAL (`REQUIREMENT_IN_PROGRESS`).
 * 5. Every candidate is decided COMPLETE: FAIL (`REQUIREMENT_ALREADY_SATISFIED`).
 * 6. No requirement lists the course: FAIL (`NOT_APPLICABLE`).
 *
 * Within a step the first candidate in audit order is reported. The same inputs always give a
 * deep-equal result.
 *
 * @param courseId - The course to place. Only this exact ID matches a candidate.
 * @param audit - The authoritative audit snapshot.
 * @param freshness - The student record the audit must reflect and the maximum skew allowed.
 * @returns A REQUIREMENT_APPLICABILITY check. Its `sourceRef` pins the audit revision as
 *   `<auditSource>:<auditVersion>`, followed by `:<requirement sourceRef>` of the deciding
 *   requirement (the candidate or an ancestor) when one decided the state. Its evidence has no ruleset version, because the audit applied no
 *   published ruleset of the engine's, and no decisive leaves.
 * @throws {AuditRecordInputError} When a timestamp or the maximum skew is invalid.
 */
export function evaluateApplicability(
  courseId: CourseId,
  audit: AuditSnapshot,
  freshness: StudentRecordFreshness,
): CheckResult {
  const auditRef = `${audit.auditSource}:${audit.auditVersion}`;
  const reflection = checkAuditReflectsRecord(
    audit,
    freshness.studentRecordEffectiveAt,
    freshness.maxSkewMs,
  );
  // SAFETY: a stale audit can't say what applies to the current record, so no requirement
  // state is read from it, and no result passes (planning/07 §Consistency model; AC10).
  if (reflection.state !== CheckState.Pass) {
    return toCheck({ state: reflection.state, reasonCode: reflection.reasonCode }, auditRef);
  }
  // SAFETY: only the exact course IDs the audit lists are candidates. Equivalents, aliases, and
  // parent or child requirements never add candidacy (planning/08 §Candidate formation).
  const findDeciding = createDecidingRequirementLookup(audit);
  const decided = audit.requirements
    .filter((requirement) => requirement.candidateCourseIds.includes(courseId))
    .map(findDeciding);
  for (const requirementState of REQUIREMENT_STATE_PRECEDENCE) {
    const deciding = decided.find((candidate) => candidate.state === requirementState);
    if (deciding !== undefined) {
      return toCheck(
        OUTCOME_BY_REQUIREMENT_STATE[requirementState],
        `${auditRef}:${deciding.requirement.sourceRef}`,
      );
    }
  }
  return toCheck({ state: CheckState.Fail, reasonCode: ReasonCode.NotApplicable }, auditRef);
}

/**
 * Builds the applicability check.
 *
 * @param outcome - The check's state and reason code.
 * @param sourceRef - The audit revision, and the deciding requirement if there is one.
 * @returns The validated check.
 */
function toCheck(outcome: RequirementOutcome, sourceRef: string): CheckResult {
  return createCheckResult({
    kind: CheckKind.RequirementApplicability,
    state: outcome.state,
    sourceRef,
    ...(outcome.reasonCode === null ? {} : { reasonCode: outcome.reasonCode }),
    evidence: { rulesetVersion: null, decisiveLeaves: [] },
  });
}
