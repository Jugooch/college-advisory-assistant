/**
 * @file Runs the frozen holdout golden set. This is the only file allowed to import it; see
 *   tests/golden/holdout/README.md.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect } from 'vitest';

import { findGoldenMismatches } from '../support/golden-runner';
import { itForFinding } from '../support/known-findings';
import { GOLDEN_HOLDOUT_CORPUS, GOLDEN_HOLDOUT_VERSION } from './holdout/holdout-corpus';

describe(`golden corpus holdout ${GOLDEN_HOLDOUT_VERSION}`, () => {
  for (const golden of GOLDEN_HOLDOUT_CORPUS) {
    itForFinding(golden.id, golden.id, () => {
      expect(findGoldenMismatches(golden)).toEqual([]);
    });
  }
});
