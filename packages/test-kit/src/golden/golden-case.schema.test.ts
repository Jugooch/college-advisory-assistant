/**
 * @file Tests for the golden case format's own invariants, so a malformed oracle fails loudly.
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { completedAttempt } from '../builders/course-attempt.builder';
import { letter } from '../builders/grade.builder';
import {
  defineGoldenCase,
  defineGoldenCorpus,
  PENDING_ACADEMIC_REVIEW,
} from './golden-case.schema';
import { prerequisiteCase } from './golden-case-factories';
import { mustNot, prerequisiteCheck } from './golden-expectations';
import { prerequisiteInputs } from './golden-inputs';
import { GoldenRuleFamily } from './golden-rule-family';

/** A valid authored case: a D against a C minimum is FAIL. */
const AUTHORED = {
  id: 'GC-MIN-900',
  family: GoldenRuleFamily.MinimumGrade,
  title: 'Schema test case',
  requirementIds: ['FR-06'],
  inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: letter('D') })] }),
  expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
  prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass')],
  rationale: 'D is below C.',
  citations: ['planning/13 AC01'],
};

describe('defineGoldenCase', () => {
  it('fills in the invoked check, the pending reviewer, and no alternatives', () => {
    const golden = prerequisiteCase(AUTHORED);

    expect(golden).toMatchObject({
      check: CheckKind.Prerequisite,
      reviewer: PENDING_ACADEMIC_REVIEW,
      adjudicatedOn: '2026-09-27',
      allowedAlternatives: [],
    });
  });

  it('rejects an ID outside the GC-/GH- scheme', () => {
    expect(() => prerequisiteCase({ ...AUTHORED, id: 'CASE-1' })).toThrow();
  });

  it('rejects a case without citations', () => {
    expect(() => prerequisiteCase({ ...AUTHORED, citations: [] })).toThrow();
  });

  it('rejects an expected state that the case also prohibits', () => {
    expect(() =>
      prerequisiteCase({ ...AUTHORED, prohibitedClaims: [mustNot(CheckState.Fail, 'x')] }),
    ).toThrow();
  });

  it('rejects an expected PASS that carries a reason code', () => {
    expect(() =>
      prerequisiteCase({
        ...AUTHORED,
        expected: [
          { ...prerequisiteCheck(CheckState.Pass, null), reasonCode: ReasonCode.MinGradeNotMet },
        ],
      }),
    ).toThrow();
  });

  it('rejects an expected check of a different kind than the one invoked', () => {
    const golden = prerequisiteCase(AUTHORED);

    expect(() =>
      defineGoldenCase({
        ...golden,
        expected: [
          {
            ...prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet),
            kind: CheckKind.CreditLoad,
          },
        ],
      }),
    ).toThrow();
  });
});

describe('defineGoldenCorpus', () => {
  it('rejects a repeated case ID', () => {
    const golden = prerequisiteCase(AUTHORED);

    expect(() => defineGoldenCorpus([golden, golden])).toThrow('repeated: GC-MIN-900');
  });
});
