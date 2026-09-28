/**
 * @file Runs the frozen holdout golden set. This is the only file allowed to import it; see
 *   packages/test-kit/src/golden/holdout/README.md.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_HOLDOUT_CORPUS, GOLDEN_HOLDOUT_VERSION } from '@caa/test-kit/golden-holdout';

import { findGoldenMismatches } from '../support/golden-runner';
import { KNOWN_FINDINGS } from './known-findings';

describe(`golden corpus holdout ${GOLDEN_HOLDOUT_VERSION}`, () => {
  for (const golden of GOLDEN_HOLDOUT_CORPUS) {
    const issue = KNOWN_FINDINGS.get(golden.id);
    if (issue === undefined) {
      it(golden.id, () => {
        expect(findGoldenMismatches(golden)).toEqual([]);
      });
    } else {
      it.fails(`${golden.id} (open finding #${String(issue)})`, () => {
        expect(findGoldenMismatches(golden)).toEqual([]);
      });
    }
  }
});
