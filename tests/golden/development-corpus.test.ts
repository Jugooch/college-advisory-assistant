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

import { GOLDEN_DEVELOPMENT_CORPUS, GoldenRuleFamily } from '@caa/test-kit';

import { findGoldenMismatches } from '../support/golden-runner';
import { KNOWN_FINDINGS } from './known-findings';

describe('golden corpus, development set', () => {
  for (const golden of GOLDEN_DEVELOPMENT_CORPUS) {
    const issue = KNOWN_FINDINGS.get(golden.id);
    if (issue === undefined) {
      it(`${golden.id}: ${golden.title}`, () => {
        expect(findGoldenMismatches(golden)).toEqual([]);
      });
    } else {
      it.fails(`${golden.id}: ${golden.title} (open finding #${String(issue)})`, () => {
        expect(findGoldenMismatches(golden)).toEqual([]);
      });
    }
  }

  it('has at least 113 cases covering every rule family', () => {
    const families = new Set(GOLDEN_DEVELOPMENT_CORPUS.map((golden) => golden.family));

    expect(GOLDEN_DEVELOPMENT_CORPUS.length).toBeGreaterThanOrEqual(113);
    expect([...families].sort()).toEqual(Object.values(GoldenRuleFamily).sort());
  });

  it('records a pending academic reviewer and an S2 or S3 adjudication date on every case', () => {
    const unreviewed = GOLDEN_DEVELOPMENT_CORPUS.filter(
      (golden) =>
        golden.reviewer !== 'pending-academic-review' ||
        !['2026-09-27', '2026-09-28', '2026-09-29'].includes(golden.adjudicatedOn),
    );

    expect(unreviewed.map((golden) => golden.id)).toEqual([]);
  });
});
