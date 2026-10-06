/**
 * @file The frozen holdout golden set. It lives in QA-owned `tests/`, which no product package can
 *   import, and is run only by `tests/golden/holdout.golden.test.ts`; see README.md in this folder.
 * @module @caa/tests/golden/holdout/holdout-corpus
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { defineGoldenCorpus, type GoldenCase, type GoldenScheduleCase } from '@caa/test-kit';

import { HOLDOUT_AUDIT_FAMILY_CASES } from './holdout-audit-families.cases';
import { HOLDOUT_CANDIDATE_SET_CASES } from './holdout-candidate-set.cases';
import { HOLDOUT_GRADE_FAMILY_CASES } from './holdout-grade-families.cases';
import { HOLDOUT_INTERACTION_CASES } from './holdout-interactions.cases';
import { HOLDOUT_PREREQUISITE_CASES } from './holdout-prerequisite.cases';
import { HOLDOUT_RULE_FAMILY_CASES } from './holdout-rule-families.cases';
import { HOLDOUT_SCHEDULE_ADDITION_CASES } from './holdout-schedule-additions.cases';
import { HOLDOUT_SCHEDULE_LINK_CASES } from './holdout-schedule-links.cases';
import { HOLDOUT_SCHEDULE_OVERLAP_CASES } from './holdout-schedule-overlap.cases';
import { HOLDOUT_SCHEDULE_SOLVER_CASES } from './holdout-schedule-solver.cases';
import { HOLDOUT_SCHEDULE_TRAVEL_CASES } from './holdout-schedule-travel.cases';

/**
 * Version of the frozen holdout. A new version is cut only as README.md describes.
 *
 * - v0.1: 8 cases, frozen 2026-09-27; moved to the pinned-input format 2026-09-28.
 * - v0.2: adds 7 interaction cases (#103), frozen 2026-09-29. No case was burned or replaced.
 * - v0.3: adds 16 cases for the 10 families that had none (#226), frozen 2026-09-29. No case was
 *   burned or replaced.
 * - v0.4: adds 14 scheduling cases across the seven scheduling families (#226), frozen 2026-10-05.
 *   No case was burned or replaced.
 * - v0.5: adds 4 scheduling cases (a second unknown-time case and three more), frozen 2026-10-06,
 *   and re-adjudicates GH-LINK-002 from ADR-0010 Amendment 5 (a dropped linked section is shown
 *   as unresolved beside the options). The scheduling cases now run through the solver.
 */
export const GOLDEN_HOLDOUT_VERSION = 'v0.5 (frozen 2026-10-06; 49 cases)';

/** Frozen holdout check cases, kept out of engine development (planning/13 §Golden corpus design). */
export const GOLDEN_HOLDOUT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...HOLDOUT_PREREQUISITE_CASES,
  ...HOLDOUT_CANDIDATE_SET_CASES,
  ...HOLDOUT_INTERACTION_CASES,
  ...HOLDOUT_GRADE_FAMILY_CASES,
  ...HOLDOUT_RULE_FAMILY_CASES,
  ...HOLDOUT_AUDIT_FAMILY_CASES,
]);

/** Frozen holdout scheduling cases, run through the solver once it exists (#220). */
export const GOLDEN_HOLDOUT_SCHEDULE_CORPUS: readonly GoldenScheduleCase[] = defineGoldenCorpus([
  ...HOLDOUT_SCHEDULE_OVERLAP_CASES,
  ...HOLDOUT_SCHEDULE_TRAVEL_CASES,
  ...HOLDOUT_SCHEDULE_LINK_CASES,
  ...HOLDOUT_SCHEDULE_SOLVER_CASES,
  ...HOLDOUT_SCHEDULE_ADDITION_CASES,
]);
