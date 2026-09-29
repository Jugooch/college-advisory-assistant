/**
 * @file The frozen holdout golden set. It lives in QA-owned `tests/`, which no product package can
 *   import, and is run only by `tests/golden/holdout.golden.test.ts`; see README.md in this folder.
 * @module @caa/tests/golden/holdout/holdout-corpus
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { defineGoldenCorpus, type GoldenCase } from '@caa/test-kit';

import { HOLDOUT_CANDIDATE_SET_CASES } from './holdout-candidate-set.cases';
import { HOLDOUT_PREREQUISITE_CASES } from './holdout-prerequisite.cases';

/** Version of the frozen holdout. A new version is cut only as README.md describes. */
export const GOLDEN_HOLDOUT_VERSION = 'v0.1 (frozen 2026-09-27; pinned-input format 2026-09-28)';

/** Frozen holdout cases, kept out of engine development (planning/13 §Golden corpus design). */
export const GOLDEN_HOLDOUT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...HOLDOUT_PREREQUISITE_CASES,
  ...HOLDOUT_CANDIDATE_SET_CASES,
]);
