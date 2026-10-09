/**
 * @file Runs the development scheduling golden cases through `buildSectionBundles` and
 *   `solveSchedule`, and checks the set covers every scheduling family.
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS } from '@caa/test-kit';

import { findScheduleMismatches } from '../support/golden-schedule-runner';
import { itForFinding } from '../support/known-findings';

describe('golden corpus, development scheduling cases', () => {
  for (const golden of GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS) {
    itForFinding(golden.id, `${golden.id}: ${golden.title}`, () => {
      expect(findScheduleMismatches(golden)).toEqual([]);
    });
  }

  it('has 37 solver cases', () => {
    expect(GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS).toHaveLength(37);
  });
});
