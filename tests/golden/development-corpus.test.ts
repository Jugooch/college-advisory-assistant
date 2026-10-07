/**
 * @file Runs the development golden corpus through the engine's public API. Each failure names
 *   the case ID and the field that differs.
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_DEVELOPMENT_CORPUS, GoldenRuleFamily, GoldenScheduleFamily } from '@caa/test-kit';

import { findGoldenMismatches } from '../support/golden-runner';
import { itForFinding } from '../support/known-findings';

describe('golden corpus, development set', () => {
  for (const golden of GOLDEN_DEVELOPMENT_CORPUS) {
    itForFinding(golden.id, `${golden.id}: ${golden.title}`, () => {
      expect(findGoldenMismatches(golden)).toEqual([]);
    });
  }

  it('has at least 137 cases covering every rule family and the #218 scheduling families', () => {
    const families = new Set<string>(GOLDEN_DEVELOPMENT_CORPUS.map((golden) => golden.family));
    const ruleFamilies: readonly string[] = Object.values(GoldenRuleFamily);

    expect(GOLDEN_DEVELOPMENT_CORPUS.length).toBeGreaterThanOrEqual(137);
    expect([...families].filter((family) => ruleFamilies.includes(family)).sort()).toEqual(
      [...ruleFamilies].sort(),
    );
    expect([...families].filter((family) => !ruleFamilies.includes(family)).sort()).toEqual([
      GoldenScheduleFamily.MeetingOverlap,
      GoldenScheduleFamily.MeetingTimeUnknown,
      GoldenScheduleFamily.TermDateOverlap,
      GoldenScheduleFamily.TransitionTime,
    ]);
  });

  it('records a pending academic reviewer and an S2 to S4 adjudication date on every case', () => {
    const unreviewed = GOLDEN_DEVELOPMENT_CORPUS.filter(
      (golden) =>
        golden.reviewer !== 'pending-academic-review' ||
        !['2026-09-27', '2026-09-28', '2026-09-29', '2026-10-05', '2026-10-06'].includes(
          golden.adjudicatedOn,
        ),
    );

    expect(unreviewed.map((golden) => golden.id)).toEqual([]);
  });
});
