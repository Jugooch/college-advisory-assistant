/**
 * @file Runs the engine's per-course and set checks on one candidate course set, from pinned inputs
 * only. Pure logic (standard 05 §Logic): it constructs nothing and reads no clock.
 * @module @caa/api/modules/course-verification/course-verification.logic
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { StudentSnapshotRevision } from '@caa/db';
import type {
  AcademicPolicy,
  AggregateState,
  AuditSnapshot,
  CheckResult,
  Course,
  CourseId,
  PrerequisiteRule,
  StudentSnapshotId,
  TermCalendar,
} from '@caa/domain';
import {
  aggregateCheckStates,
  checkAllocation,
  checkCreditLoad,
  type CourseSelection,
  evaluateApplicability,
  evaluatePrerequisite,
} from '@caa/engine';

/** One requested course, from the tenant's catalog, and its rule at the active ruleset. */
export interface RequestedCourse {
  readonly course: Course;
  /** `null` when the ruleset has no prerequisite rule for the course. */
  readonly rule: PrerequisiteRule | null;
}

/** Every input of one check run. All are pinned revisions loaded for the session's tenant. */
export interface CourseSetInputs {
  /** The candidate set, in request order. */
  readonly courses: readonly RequestedCourse[];
  /** Chosen credits for variable-credit courses, each naming a course in `courses`. */
  readonly creditSelections: readonly {
    readonly courseId: CourseId;
    readonly selectedCreditsHundredths: number;
  }[];
  /** The pinned student record and its attempts. */
  readonly revision: StudentSnapshotRevision;
  readonly audit: AuditSnapshot;
  /** The tenant's whole catalog, so required courses' equivalents can be found. */
  readonly catalog: readonly Course[];
  readonly academicPolicy: AcademicPolicy;
  /** The tenant's stored terms, oldest first; never a caller-supplied order. */
  readonly termCalendar: TermCalendar;
  /** The configured record and audit skew in milliseconds. */
  readonly maxSkewMs: number;
}

/** The results of one course: `prerequisite` is `null` when the course has no rule. */
export interface CourseCheck {
  readonly courseId: CourseId;
  readonly prerequisite: CheckResult | null;
  readonly applicability: CheckResult;
}

/** Every check of a candidate set, its aggregate, and the inputs it was computed from. */
export interface CourseChecks {
  readonly courseResults: readonly CourseCheck[];
  readonly setResults: {
    readonly allocation: readonly CheckResult[];
    readonly creditLoad: CheckResult;
  };
  readonly aggregate: AggregateState;
  readonly pinnedInputs: {
    readonly studentSnapshotId: StudentSnapshotId;
    /** The snapshot's `sourceEffectiveAt`: the record time every result is valid as of. */
    readonly studentRecordEffectiveAt: string;
    /** The audit's `studentRecordEffectiveAt`: the record time the audit ran against. */
    readonly auditRecordEffectiveAt: string;
    readonly auditSource: string;
    readonly auditVersion: string;
    readonly rulesetVersion: string;
  };
}

/**
 * Builds the engine's candidate set from the requested courses and credit choices.
 *
 * @param inputs - The requested courses and credit choices.
 * @returns One selection per course, in request order.
 */
function toSelections(inputs: CourseSetInputs): readonly CourseSelection[] {
  const chosen = new Map(
    inputs.creditSelections.map((selection) => [
      selection.courseId,
      selection.selectedCreditsHundredths,
    ]),
  );
  return inputs.courses.map(({ course }) => ({
    course,
    // SAFETY: a course with no choice stays `null`, which the credit-load check reports as
    // UNKNOWN; no value is assumed (planning/08 §Candidate formation; AC18).
    selectedCreditsHundredths: chosen.get(course.id) ?? null,
    // NOTE: the catalog doesn't model linked sections whose credits another course already
    // includes, so every course counts its own credits, as a lab with its own credit does.
    countsCredits: true,
  }));
}

/**
 * Runs every check on the candidate set: per course, the prerequisite (when there is a rule)
 * and the requirement applicability; for the set, allocation and credit load. The aggregate
 * comes from the engine. The same inputs always give a deep-equal result: no clock is read.
 *
 * @param inputs - Every pinned input.
 * @returns The checks, the aggregate, and the pinned input versions.
 * @throws {CandidateSetInputError} When the engine rejects the candidate set or its credits.
 * @throws {AuditRecordInputError} When a timestamp or the skew can't be compared.
 * @throws {PrerequisiteInputMismatchError} When a rule and the policy don't match.
 */
export function verifyCourseSet(inputs: CourseSetInputs): CourseChecks {
  const { revision, audit, academicPolicy, termCalendar, maxSkewMs } = inputs;
  const pinned = { studentSnapshot: revision.snapshot, maxSkewMs };
  const record = { attempts: revision.attempts, courses: inputs.catalog };
  const resolution = { academicPolicy, termCalendar };
  const courseResults = inputs.courses.map(({ course, rule }) => ({
    courseId: course.id,
    // SAFETY: no rule is `null`, shown as "no rule checked", never as a PASS (course-checks
    // contract).
    prerequisite: rule === null ? null : evaluatePrerequisite(rule, record, resolution),
    applicability: evaluateApplicability(course.id, audit, pinned),
  }));
  const selections = toSelections(inputs);
  const allocation = checkAllocation(selections, audit, pinned);
  const creditLoad = checkCreditLoad(selections, academicPolicy);
  const states = [
    ...courseResults.flatMap(({ prerequisite, applicability }) =>
      prerequisite === null ? [applicability] : [prerequisite, applicability],
    ),
    ...allocation,
    creditLoad,
  ].map((check) => check.state);
  return {
    courseResults,
    setResults: { allocation, creditLoad },
    aggregate: aggregateCheckStates(states),
    pinnedInputs: {
      studentSnapshotId: revision.snapshot.id,
      studentRecordEffectiveAt: revision.snapshot.sourceEffectiveAt,
      auditRecordEffectiveAt: audit.studentRecordEffectiveAt,
      auditSource: audit.auditSource,
      auditVersion: audit.auditVersion,
      rulesetVersion: academicPolicy.rulesetVersion,
    },
  };
}
