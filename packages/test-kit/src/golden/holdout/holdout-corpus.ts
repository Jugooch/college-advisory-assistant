/**
 * @file The frozen holdout golden set. It is exported only through `@caa/test-kit/golden-holdout`
 *   and run only by `tests/golden/holdout.golden.test.ts`; see README.md in this folder.
 * @module @caa/test-kit/golden/holdout/holdout-corpus
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { defineGoldenCorpus, type GoldenCase } from '../golden-case.schema';
import { HOLDOUT_CANDIDATE_SET_CASES } from './holdout-candidate-set.cases';
import { HOLDOUT_PREREQUISITE_CASES } from './holdout-prerequisite.cases';

/** Version of the frozen holdout. A new version is cut only as README.md describes. */
export const GOLDEN_HOLDOUT_VERSION = 'v0 (frozen 2026-09-27)';

/** Frozen holdout cases, kept out of engine development (planning/13 §Golden corpus design). */
export const GOLDEN_HOLDOUT_CORPUS: readonly GoldenCase[] = defineGoldenCorpus([
  ...HOLDOUT_PREREQUISITE_CASES,
  ...HOLDOUT_CANDIDATE_SET_CASES,
]);
