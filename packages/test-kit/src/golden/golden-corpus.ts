/**
 * @file The development golden corpus: every rule family (v0 from S2, extended in S3 for pinned
 *   inputs), independently adjudicated from the planning docs. The frozen holdout lives apart, in
 *   `tests/golden/holdout/` (see its README).
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
import { EXPRESSION_CASES } from './cases/expressions.cases';
import { MINIMUM_GRADE_CASES } from './cases/minimum-grade.cases';
import { PASSING_CUTOFF_CASES } from './cases/passing-cutoff.cases';
import { PINNED_RECORD_CASES } from './cases/pinned-record.cases';
import { PROGRAM_CATALOG_CASES } from './cases/program-catalog.cases';
import { REPEAT_CASES } from './cases/repeats.cases';
import { RETAKE_AND_EQUIVALENCY_CASES } from './cases/retakes-and-equivalency.cases';
import { TERM_ORDER_CASES } from './cases/term-order.cases';
import { defineGoldenCorpus, type GoldenCase } from './golden-case.schema';

/**
 * Development cases, open to every engineer as fixtures and for debugging. Expected values are
 * written literally from planning/07, planning/08, planning/09, planning/13, the S2 and S3
 * issues, and recorded tech-lead decisions; they are never computed by engine code and never edited to match it.
 */
export const GOLDEN_DEVELOPMENT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...MINIMUM_GRADE_CASES,
  ...PASSING_CUTOFF_CASES,
  ...ATTEMPT_STATUS_CASES,
  ...REPEAT_CASES,
  ...RETAKE_AND_EQUIVALENCY_CASES,
  ...TERM_ORDER_CASES,
  ...EXPRESSION_CASES,
  ...APPLICABILITY_CASES,
  ...ALLOCATION_CASES,
  ...PINNED_RECORD_CASES,
  ...PROGRAM_CATALOG_CASES,
  ...CREDIT_LOAD_CASES,
  ...CREDIT_BOUNDS_UNDEFINED_CASES,
]);
