/**
 * @file The rule families the golden corpus is organized by.
 * @module @caa/test-kit/golden/golden-rule-family
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

/**
 * Rule family of a golden case, so coverage can be counted per family (planning/13 §Proposed
 * student-pilot release gates: every supported rule family has positive, negative, boundary, and
 * unknown cases).
 *
 * - `MINIMUM_GRADE`: a letter grade against a letter minimum.
 * - `PASS_FAIL_EQUIVALENCE`: a `P` grade against a letter minimum.
 * - `PASSING_CUTOFF`: a rule with no minimum, decided by the policy's lowest passing letter.
 * - `UNRANKED_GRADE`: a grade the policy's order can't rank, or a scheme it can't compare.
 * - `IN_PROGRESS`: a prerequisite that is currently in progress.
 * - `PENDING_TRANSFER`: transfer credit that is still under evaluation.
 * - `INCOMPLETE_ATTEMPT`: an attempt with a deferred grade.
 * - `REPEAT`: a repeated course under a repeat policy.
 * - `EQUIVALENCY`: courses that share an equivalency group.
 * - `AND_OR_EXPRESSION`: nested `ALL`/`ANY` prerequisite expressions.
 * - `UNSUPPORTED_RULE`: source rule text the app can't represent.
 * - `CATALOG_GAP`: a required or attempted course the catalog doesn't contain.
 * - `APPLICABILITY`: whether the audit lists a course for an outstanding requirement.
 * - `AUDIT_STALE`: the pinned snapshot's time against the audit's record time, newer or older,
 *   beyond or exactly at the allowed skew.
 * - `AUDIT_RECORD_MISMATCH`: an audit run against another tenant's, student's, or snapshot
 *   revision's record than the one pinned.
 * - `PROGRAM_CATALOG`: a pinned record and audit that disagree on program or catalog, or a
 *   record that states neither.
 * - `ALLOCATION`: candidate courses competing for audit requirements.
 * - `CREDIT_BOUNDS`: a candidate set's credit total against the load bounds.
 * - `VARIABLE_CREDIT`: a variable-credit course inside a candidate set.
 * - `TERM_ORDER`: repeated attempts ordered by the tenant's term calendar.
 * - `NO_PREREQUISITE`: an explicit `NONE` rule (PASS) against a course with no rule row (UNKNOWN).
 */
export const GoldenRuleFamily = {
  MinimumGrade: 'MINIMUM_GRADE',
  PassFailEquivalence: 'PASS_FAIL_EQUIVALENCE',
  PassingCutoff: 'PASSING_CUTOFF',
  UnrankedGrade: 'UNRANKED_GRADE',
  InProgress: 'IN_PROGRESS',
  PendingTransfer: 'PENDING_TRANSFER',
  IncompleteAttempt: 'INCOMPLETE_ATTEMPT',
  Repeat: 'REPEAT',
  Equivalency: 'EQUIVALENCY',
  AndOrExpression: 'AND_OR_EXPRESSION',
  UnsupportedRule: 'UNSUPPORTED_RULE',
  CatalogGap: 'CATALOG_GAP',
  Applicability: 'APPLICABILITY',
  AuditStale: 'AUDIT_STALE',
  AuditRecordMismatch: 'AUDIT_RECORD_MISMATCH',
  ProgramCatalog: 'PROGRAM_CATALOG',
  Allocation: 'ALLOCATION',
  CreditBounds: 'CREDIT_BOUNDS',
  VariableCredit: 'VARIABLE_CREDIT',
  TermOrder: 'TERM_ORDER',
  NoPrerequisite: 'NO_PREREQUISITE',
} as const;

/** Union of every {@link GoldenRuleFamily} value. */
export type GoldenRuleFamily = (typeof GoldenRuleFamily)[keyof typeof GoldenRuleFamily];

/** Runtime schema for {@link GoldenRuleFamily}. */
export const GoldenRuleFamilySchema = z.enum(GoldenRuleFamily);

/**
 * Scheduling family of a golden case (#226), counted apart from the check families above: a
 * scheduling family is covered by section-pair cases, solver cases, or both.
 *
 * - `MEETING_OVERLAP`: two timed meetings by weekday, time, excluded dates, and DST.
 * - `TERM_DATE_OVERLAP`: meetings in half-terms or other partial date ranges (AC07).
 * - `TRANSITION_TIME`: travel between campuses against the transition table (AC08).
 * - `LINKED_SECTION`: lectures with required linked components, and their credits (AC06).
 * - `MEETING_TIME_UNKNOWN`: TBA times, days, or locations, which are never PASS.
 * - `HARD_VERSUS_SOFT`: hard constraints never relaxed, preferences ranked.
 * - `SOLVER_OUTCOME`: complete, incomplete, infeasible, timeout (AC12), and the tie-break.
 */
export const GoldenScheduleFamily = {
  MeetingOverlap: 'MEETING_OVERLAP',
  TermDateOverlap: 'TERM_DATE_OVERLAP',
  TransitionTime: 'TRANSITION_TIME',
  LinkedSection: 'LINKED_SECTION',
  MeetingTimeUnknown: 'MEETING_TIME_UNKNOWN',
  HardVersusSoft: 'HARD_VERSUS_SOFT',
  SolverOutcome: 'SOLVER_OUTCOME',
} as const;

/** Union of every {@link GoldenScheduleFamily} value. */
export type GoldenScheduleFamily = (typeof GoldenScheduleFamily)[keyof typeof GoldenScheduleFamily];

/** Runtime schema for {@link GoldenScheduleFamily}. */
export const GoldenScheduleFamilySchema = z.enum(GoldenScheduleFamily);
