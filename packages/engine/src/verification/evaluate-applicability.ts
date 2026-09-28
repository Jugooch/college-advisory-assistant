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
  checkSnapshotConsistency,
  type StudentRecordFreshness,
} from './check-snapshot-consistency';

/** The applicability a requirement in one audit state gives a course it lists as a candidate. */
interface RequirementOutcome {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

// SAFETY: each requirement is judged by its own audit state, never by its parent's or its
// children's, so a parent is never treated as satisfied or outstanding from partial children
// (requirement-result.model.ts; planning/08 §Authority and result semantics: the audit owns
// allocation).
const OUTCOME_BY_REQUIREMENT_STATE: Readonly<Record<RequirementState, RequirementOutcome>> = {
  [RequirementState.Incomplete]: { state: CheckState.Pass, reasonCode: null },
  // SAFETY: an IN_PROGRESS requirement is satisfied if its in-progress attempts finish as
  // required, and then the course adds nothing. The course applies only if they don't, so the
  // result is CONDITIONAL on in-progress outcomes, never PASS (requirement-state.enum.ts;
  // planning/08 §Eligibility semantics: in-progress work is conditional).
  [RequirementState.InProgress]: {
    state: CheckState.Conditional,
    reasonCode: ReasonCode.InProgressMinGrade,
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
 * Decisions, in order:
 * 1. The audit is stale for the student record (see `checkSnapshotConsistency`): UNKNOWN
 *    (`AUDIT_STALE`), whatever the requirements say.
 * 2. The course is a candidate for an AMBIGUOUS requirement: UNKNOWN (`AUDIT_AMBIGUOUS`).
 * 3. It is a candidate for an INCOMPLETE requirement: PASS.
 * 4. It is a candidate for an IN_PROGRESS requirement: CONDITIONAL (`IN_PROGRESS_MIN_GRADE`).
 * 5. It is a candidate only for COMPLETE requirements: FAIL (`REQUIREMENT_ALREADY_SATISFIED`).
 * 6. It is a candidate for no requirement: FAIL (`NOT_APPLICABLE`).
 *
 * Within a step the first matching requirement in audit order is reported. The same inputs
 * always give a deep-equal result.
 *
 * @param courseId - The course to place. Only this exact ID matches a candidate.
 * @param audit - The authoritative audit snapshot.
 * @param freshness - The student record the audit must reflect and the maximum skew allowed.
 * @returns A REQUIREMENT_APPLICABILITY check. Its `sourceRef` pins the audit revision as
 *   `<auditSource>:<auditVersion>`, followed by `:<requirement sourceRef>` when a requirement
 *   decided the state. Its evidence has no ruleset version, because the audit applied no
 *   published ruleset of the engine's, and no decisive leaves.
 * @throws {SnapshotConsistencyInputError} When a timestamp or the maximum skew is invalid.
 */
export function evaluateApplicability(
  courseId: CourseId,
  audit: AuditSnapshot,
  freshness: StudentRecordFreshness,
): CheckResult {
  const auditRef = `${audit.auditSource}:${audit.auditVersion}`;
  const consistency = checkSnapshotConsistency(
    audit,
    freshness.studentRecordEffectiveAt,
    freshness.maxSkewMs,
  );
  // SAFETY: a stale audit can't say what applies to the current record, so no requirement
  // state is read from it, and no result passes (planning/07 §Consistency model; AC10).
  if (consistency.state !== CheckState.Pass) {
    return toCheck({ state: consistency.state, reasonCode: consistency.reasonCode }, auditRef);
  }
  // SAFETY: only the exact course IDs the audit lists are candidates. Equivalents, aliases, and
  // parent or child requirements never add candidacy (planning/08 §Candidate formation).
  const candidates = audit.requirements.filter((requirement) =>
    requirement.candidateCourseIds.includes(courseId),
  );
  for (const requirementState of REQUIREMENT_STATE_PRECEDENCE) {
    const requirement = candidates.find((candidate) => candidate.state === requirementState);
    if (requirement !== undefined) {
      return toCheck(
        OUTCOME_BY_REQUIREMENT_STATE[requirementState],
        `${auditRef}:${requirement.sourceRef}`,
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
