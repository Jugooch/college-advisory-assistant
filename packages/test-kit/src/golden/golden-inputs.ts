/**
 * @file Shared synthetic inputs and adjudication fields for golden cases, so each case states
 *   only what makes it distinct.
 * @module @caa/test-kit/golden/golden-inputs
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import {
  type AcademicPolicy,
  type AcademicPolicyInput,
  type Course,
  type CourseAttempt,
  type PrerequisiteRule,
  type RequirementResultInput,
  type StudentSnapshot,
  type StudentSnapshotInput,
  type TermCalendar,
  type TermCreditBounds,
} from '@caa/domain';

import { buildAcademicPolicy } from '../builders/academic-policy.builder';
import { buildAuditSnapshot } from '../builders/audit-snapshot.builder';
import { buildPrerequisiteRule } from '../builders/prerequisite-rule.builder';
import { buildRequirementResult } from '../builders/requirement-result.builder';
import { buildStudentSnapshot } from '../builders/student-snapshot.builder';
import { buildTermCalendar } from '../builders/term.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { PENDING_ACADEMIC_REVIEW } from './golden-case.schema';

/**
 * The synthetic tenant's term calendar: `2025FA`, `2026SP`, `2026FA`, `2027SP` with sequences 1
 * to 4 (`buildTermCalendar()`).
 */
export const GOLDEN_TERM_CALENDAR: TermCalendar = buildTermCalendar();

/** The complete synthetic catalog, so no attempted course is ever missing by accident. */
export const GOLDEN_CATALOG: readonly Course[] = Object.values(SYNTHETIC_COURSES);

/** Reviewer and adjudication date of every v0 case, until an academic owner reviews them. */
export const GOLDEN_REVIEW = {
  reviewer: PENDING_ACADEMIC_REVIEW,
  adjudicatedOn: '2026-09-27',
} as const;

/**
 * Adjudication date of the S3 cases (pinned inputs, #122), and of v0 cases whose expectation was
 * adjudicated again for them.
 */
export const S3_ADJUDICATED_ON = '2026-09-28';

/** Adjudication date of the S3 interaction cases (golden corpus growth track, #103). */
export const S3_INTERACTIONS_ADJUDICATED_ON = '2026-09-29';

/** Source versions behind every prerequisite case. */
export const PREREQUISITE_SOURCES: readonly string[] = [
  'ruleset demo-2026.1',
  'catalog SYNTHETIC_COURSES v0',
  'terms SYNTHETIC_TERMS v0',
];

/** Source versions behind every case that reads the default audit. */
export const AUDIT_SOURCES: readonly string[] = [
  'audit demo-audit:audit_demo_r1',
  'student snapshot a0000000-0000-4000-8000-000000000001',
];

/** Source versions behind every credit-load case. */
export const CREDIT_LOAD_SOURCES: readonly string[] = [
  'ruleset demo-2026.1',
  'catalog SYNTHETIC_COURSES v0',
];

/** `sourceRef` of the default prerequisite rule, seed 1. */
export const GOLDEN_RULE_REF = 'demo-rule-0001';

/** When the default audit's student record took effect (builder default). */
export const AUDIT_RECORD_AT = '2026-09-20T07:30:00.000-05:00';

/** The pinned student record the default audit ran against: snapshot seed 1 (builder default). */
export const GOLDEN_SNAPSHOT: StudentSnapshot = buildStudentSnapshot();

/** The pinned record and allowed skew an audit-derived check reads. */
export interface GoldenPinnedRecord {
  readonly studentSnapshot: StudentSnapshot;
  readonly maxSkewMs: number;
}

/** The snapshot the default audit ran against, with no skew allowed. */
export const FRESH_RECORD: GoldenPinnedRecord = { studentSnapshot: GOLDEN_SNAPSHOT, maxSkewMs: 0 };

/**
 * Pins a student record that differs from the default snapshot.
 *
 * @param overrides - Snapshot fields that differ from `buildStudentSnapshot()`.
 * @param maxSkewMs - The partner's allowed skew in milliseconds.
 * @param seed - Snapshot seed; 1 is the revision the default audit ran against, any other is a
 *   different revision.
 * @returns The pinned record.
 */
export function pinnedRecord(
  overrides: Partial<StudentSnapshotInput>,
  maxSkewMs = 0,
  seed = 1,
): GoldenPinnedRecord {
  return { studentSnapshot: buildStudentSnapshot(overrides, seed), maxSkewMs };
}

/** What a prerequisite case varies; everything else is the default. */
export interface PrerequisiteVariation {
  /** Policy switches this case is about; the rest stay the conservative defaults. */
  readonly policy?: Partial<AcademicPolicyInput>;
  readonly attempts?: readonly CourseAttempt[];
  /** The rule; defaults to DEMO-MATH 102 requiring DEMO-MATH 101 with at least `C`. */
  readonly rule?: PrerequisiteRule;
  /** The catalog; defaults to {@link GOLDEN_CATALOG}. */
  readonly courses?: readonly Course[];
  /** The term calendar; defaults to {@link GOLDEN_TERM_CALENDAR}. */
  readonly termCalendar?: TermCalendar;
}

/**
 * Builds the complete inputs of a prerequisite case.
 *
 * @param variation - The policy switches, attempts, rule, catalog, and calendar the case is about.
 * @returns Policy, term calendar, catalog, attempts, and rule.
 */
export function prerequisiteInputs(variation: PrerequisiteVariation = {}): {
  academicPolicy: AcademicPolicy;
  termCalendar: TermCalendar;
  courses: readonly Course[];
  attempts: readonly CourseAttempt[];
  rule: PrerequisiteRule;
} {
  return {
    academicPolicy: buildAcademicPolicy(variation.policy),
    termCalendar: variation.termCalendar ?? GOLDEN_TERM_CALENDAR,
    courses: variation.courses ?? GOLDEN_CATALOG,
    attempts: variation.attempts ?? [],
    rule: variation.rule ?? buildPrerequisiteRule(),
  };
}

/**
 * Builds the default policy (ruleset `demo-2026.1`) with the given term credit bounds.
 *
 * @param minCreditsHundredths - Minimum load in hundredths.
 * @param maxCreditsHundredths - Maximum load in hundredths.
 * @returns The policy.
 */
export function loadPolicy(
  minCreditsHundredths: TermCreditBounds['minCreditsHundredths'],
  maxCreditsHundredths: TermCreditBounds['maxCreditsHundredths'],
): AcademicPolicy {
  return buildAcademicPolicy({
    termCreditBounds: { minCreditsHundredths, maxCreditsHundredths },
  });
}

/**
 * Builds the default audit (`demo-audit`, `audit_demo_r1`) with the given requirements, each
 * built from `buildRequirementResult` with its own seed (`REQ-001`, `REQ-002`, ...).
 *
 * @param requirements - Overrides for each requirement, in audit order.
 * @returns A validated audit snapshot.
 */
export function auditWith(
  ...requirements: Partial<RequirementResultInput>[]
): ReturnType<typeof buildAuditSnapshot> {
  return buildAuditSnapshot({
    requirements: requirements.map((overrides, index) =>
      buildRequirementResult(overrides, index + 1),
    ),
  });
}

/**
 * Returns the `sourceRef` the audit's requirement `REQ-<n>` is pinned by, for example
 * `demo-audit:audit_demo_r1:demo-audit/REQ-001` (planning/08 §Evidence contract example).
 *
 * @param requirementNumber - The requirement's seed.
 * @returns The pinned reference, written out literally from the audit's fields.
 */
export function auditRequirementRef(requirementNumber: number): string {
  return `demo-audit:audit_demo_r1:demo-audit/REQ-${String(requirementNumber).padStart(3, '0')}`;
}

/** One planned course of a candidate set, in the golden format. */
export interface GoldenSelection {
  readonly course: Course;
  readonly selectedCreditsHundredths: number | null;
  readonly countsCredits: boolean;
}

/**
 * Plans one course of a candidate set.
 *
 * @param plannedCourse - The course.
 * @param selectedCreditsHundredths - The chosen credits of a variable-credit course; `null` (the
 *   default) when none is chosen or the course has fixed credits.
 * @param countsCredits - `false` for a linked section already included in its lecture's credits.
 * @returns The selection.
 */
export function planned(
  plannedCourse: Course,
  selectedCreditsHundredths: number | null = null,
  countsCredits = true,
): GoldenSelection {
  return { course: plannedCourse, selectedCreditsHundredths, countsCredits };
}
