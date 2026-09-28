/**
 * @file Acceptance: a repeated course, or two courses sharing an equivalency group, never earns
 *   duplicate credit unless policy explicitly permits it.
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { describe, expect, it } from 'vitest';

import { CountingState, RepeatPolicy } from '@caa/domain';
import { CandidateSetInputError, checkCreditLoad, resolveAttempts } from '@caa/engine';
import {
  buildAcademicPolicy,
  completedAttempt,
  GOLDEN_CATALOG,
  GOLDEN_TERM_ORDER,
  planned,
  SYNTHETIC_COURSES,
  syntheticId,
} from '@caa/test-kit';

const MATH101_THEN_MATH111 = [
  completedAttempt({ termCode: '2025FA' }, 1),
  completedAttempt({ courseId: SYNTHETIC_COURSES.math111.id, termCode: '2026SP' }, 2),
];

describe('AC04 equivalents and repeats earn credit once', () => {
  it('resolves two equivalents to one group with 3.00 credits, not 6.00', () => {
    const groups = resolveAttempts(MATH101_THEN_MATH111, GOLDEN_CATALOG, {
      academicPolicy: buildAcademicPolicy({ repeatPolicy: RepeatPolicy.MostRecent }),
      termCodesOldestFirst: GOLDEN_TERM_ORDER,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.counting).toMatchObject({
      state: CountingState.Counted,
      attempt: { id: syntheticId('attempt', 2) },
      earnedCreditsHundredths: 300,
    });
  });

  it('leaves earned credit unknown, never 6.00, when no repeat policy says which attempt counts', () => {
    const groups = resolveAttempts(MATH101_THEN_MATH111, GOLDEN_CATALOG, {
      academicPolicy: buildAcademicPolicy({ repeatPolicy: null }),
      termCodesOldestFirst: GOLDEN_TERM_ORDER,
    });

    expect(groups[0]?.counting).toMatchObject({
      state: CountingState.Undetermined,
      earnedCreditsHundredths: null,
    });
  });

  it('refuses to load two equivalents into one candidate set instead of counting both', () => {
    const selections = [planned(SYNTHETIC_COURSES.math101), planned(SYNTHETIC_COURSES.math111)];

    expect(() =>
      checkCreditLoad(selections, {
        minCreditsHundredths: 0,
        maxCreditsHundredths: 1800,
        sourceRef: 'demo-load-policy-2026FA',
      }),
    ).toThrow(CandidateSetInputError);
  });
});
