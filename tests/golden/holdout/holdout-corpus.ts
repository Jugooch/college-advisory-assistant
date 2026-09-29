/**
 * @file The frozen holdout golden set. It lives in QA-owned `tests/`, which no product package can
 *   import, and is run only by `tests/golden/holdout.golden.test.ts`; see README.md in this folder.
 * @module @caa/tests/golden/holdout/holdout-corpus
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { defineGoldenCorpus, type GoldenCase } from '@caa/test-kit';

import { HOLDOUT_AUDIT_FAMILY_CASES } from './holdout-audit-families.cases';
import { HOLDOUT_CANDIDATE_SET_CASES } from './holdout-candidate-set.cases';
import { HOLDOUT_GRADE_FAMILY_CASES } from './holdout-grade-families.cases';
import { HOLDOUT_INTERACTION_CASES } from './holdout-interactions.cases';
import { HOLDOUT_PREREQUISITE_CASES } from './holdout-prerequisite.cases';
import { HOLDOUT_RULE_FAMILY_CASES } from './holdout-rule-families.cases';

/**
 * Version of the frozen holdout. A new version is cut only as README.md describes.
 *
 * - v0.1: 8 cases, frozen 2026-09-27; moved to the pinned-input format 2026-09-28.
 * - v0.2: adds 7 interaction cases (#103), frozen 2026-09-29. No case was burned or replaced.
 * - v0.3: adds 16 cases for the 10 families that had none (#226), frozen 2026-09-29. No case was
 *   burned or replaced.
 */
export const GOLDEN_HOLDOUT_VERSION = 'v0.3 (frozen 2026-09-29; 31 cases)';

/** Frozen holdout cases, kept out of engine development (planning/13 §Golden corpus design). */
export const GOLDEN_HOLDOUT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...HOLDOUT_PREREQUISITE_CASES,
  ...HOLDOUT_CANDIDATE_SET_CASES,
  ...HOLDOUT_INTERACTION_CASES,
  ...HOLDOUT_GRADE_FAMILY_CASES,
  ...HOLDOUT_RULE_FAMILY_CASES,
  ...HOLDOUT_AUDIT_FAMILY_CASES,
]);
