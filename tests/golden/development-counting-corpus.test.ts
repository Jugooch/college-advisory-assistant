/**
 * @file Runs the development attempt-counting golden cases (repeat for credit) through
 *   `resolveAttempts`, and checks the family covers within, at, and over a cap, non-repeatable
 *   courses, and the undetermined cases.
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 */
import { describe, expect, it } from 'vitest';

import { CountingState } from '@caa/domain';
import { GOLDEN_DEVELOPMENT_COUNTING_CORPUS } from '@caa/test-kit';

import { findCountingMismatches } from '../support/golden-counting-runner';
import { itForFinding } from '../support/known-findings';

describe('golden corpus, development attempt-counting cases', () => {
  for (const golden of GOLDEN_DEVELOPMENT_COUNTING_CORPUS) {
    itForFinding(golden.id, `${golden.id}: ${golden.title}`, () => {
      expect(findCountingMismatches(golden)).toEqual([]);
    });
  }

  it('has 20 cases covering counted, none, and undetermined groups', () => {
    const states = new Set(
      GOLDEN_DEVELOPMENT_COUNTING_CORPUS.map((golden) => golden.expected.state),
    );

    expect(GOLDEN_DEVELOPMENT_COUNTING_CORPUS).toHaveLength(20);
    expect([...states].sort()).toEqual([
      CountingState.Counted,
      CountingState.None,
      CountingState.Undetermined,
    ]);
  });
});
