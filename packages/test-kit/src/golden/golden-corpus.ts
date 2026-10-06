/**
 * @file The development golden corpus: every rule family (v0 from S2, extended in S3 for pinned
 *   inputs and for interactions between families), independently adjudicated from the planning
 *   docs. The frozen holdout lives apart, in `tests/golden/holdout/` (see its README).
 * @module @caa/test-kit/golden/golden-corpus
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { ALLOCATION_CASES } from './cases/allocation.cases';
import { APPLICABILITY_CASES } from './cases/applicability.cases';
import { ATTEMPT_STATUS_CASES } from './cases/attempt-status.cases';
import { CREDIT_BOUNDS_UNDEFINED_CASES } from './cases/credit-bounds-undefined.cases';
import { CREDIT_LOAD_CASES } from './cases/credit-load.cases';
import { CUTOFF_PASS_FAIL_CASES } from './cases/cutoff-pass-fail.cases';
import { EXPRESSION_CASES } from './cases/expressions.cases';
import { HARD_CONSTRAINT_LIMIT_CASES } from './cases/hard-constraint-limits.cases';
import { HARD_VERSUS_SOFT_CASES } from './cases/hard-versus-soft.cases';
import { LINKED_SECTION_CASES } from './cases/linked-section.cases';
import { LINKED_SECTION_COMPONENT_CASES } from './cases/linked-section-components.cases';
import { LINKED_SECTION_CREDIT_CASES } from './cases/linked-section-credits.cases';
import { MEETING_OVERLAP_CASES } from './cases/meeting-overlap.cases';
import { MEETING_TIME_UNKNOWN_CASES } from './cases/meeting-time-unknown.cases';
import { MINIMUM_GRADE_CASES } from './cases/minimum-grade.cases';
import { PASSING_CUTOFF_CASES } from './cases/passing-cutoff.cases';
import { PENDING_TRANSFER_REPEAT_CASES } from './cases/pending-transfer-repeats.cases';
import { PINNED_RECORD_CASES } from './cases/pinned-record.cases';
import { PROGRAM_CATALOG_CASES } from './cases/program-catalog.cases';
import { REPEAT_CASES } from './cases/repeats.cases';
import { REQUIREMENT_ANCESTOR_CASES } from './cases/requirement-ancestors.cases';
import { RETAKE_AND_EQUIVALENCY_CASES } from './cases/retakes-and-equivalency.cases';
import { SOLVER_CAP_AND_MISSING_DATA_CASES } from './cases/solver-cap-and-missing-data.cases';
import { SOLVER_OUTCOME_CASES } from './cases/solver-outcome.cases';
import { SOLVER_TRAVEL_AND_TBA_CASES } from './cases/solver-travel-and-tba.cases';
import { TERM_DATE_OVERLAP_CASES } from './cases/term-date-overlap.cases';
import { TERM_ORDER_CASES } from './cases/term-order.cases';
import { TRANSITION_TIME_CASES } from './cases/transition-time.cases';
import { VARIABLE_CREDIT_ALLOCATION_CASES } from './cases/variable-credit-allocation.cases';
import { defineGoldenCorpus, type GoldenCase } from './golden-case.schema';
import type { GoldenScheduleCase } from './golden-schedule-case.schema';

/**
 * Development cases, open to every engineer as fixtures and for debugging. Expected values are
 * written literally from planning/07, planning/08, planning/09, planning/13, the S2 and S3
 * issues, and recorded tech-lead decisions; they are never computed by engine code and never edited to match it.
 */
export const GOLDEN_DEVELOPMENT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...MINIMUM_GRADE_CASES,
  ...PASSING_CUTOFF_CASES,
  ...CUTOFF_PASS_FAIL_CASES,
  ...ATTEMPT_STATUS_CASES,
  ...PENDING_TRANSFER_REPEAT_CASES,
  ...REPEAT_CASES,
  ...RETAKE_AND_EQUIVALENCY_CASES,
  ...TERM_ORDER_CASES,
  ...EXPRESSION_CASES,
  ...APPLICABILITY_CASES,
  ...REQUIREMENT_ANCESTOR_CASES,
  ...ALLOCATION_CASES,
  ...VARIABLE_CREDIT_ALLOCATION_CASES,
  ...PINNED_RECORD_CASES,
  ...PROGRAM_CATALOG_CASES,
  ...CREDIT_LOAD_CASES,
  ...CREDIT_BOUNDS_UNDEFINED_CASES,
  ...MEETING_OVERLAP_CASES,
  ...TERM_DATE_OVERLAP_CASES,
  ...TRANSITION_TIME_CASES,
  ...MEETING_TIME_UNKNOWN_CASES,
]);

/**
 * Development scheduling cases, solved by `solveSchedule` (#219, #220). Their expectation is a
 * whole response, so they are a corpus of their own beside the check cases.
 */
export const GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS: readonly GoldenScheduleCase[] = defineGoldenCorpus(
  [
    ...LINKED_SECTION_CASES,
    ...LINKED_SECTION_CREDIT_CASES,
    ...LINKED_SECTION_COMPONENT_CASES,
    ...HARD_VERSUS_SOFT_CASES,
    ...HARD_CONSTRAINT_LIMIT_CASES,
    ...SOLVER_OUTCOME_CASES,
    ...SOLVER_CAP_AND_MISSING_DATA_CASES,
    ...SOLVER_TRAVEL_AND_TBA_CASES,
  ],
);
