/**
 * @file Golden cases: a credit-load check when the institution hasn't supplied the term's credit
 *   bounds (`AcademicPolicy.termCreditBounds` is `null`).
 * @module @caa/test-kit/golden/cases/credit-bounds-undefined
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { buildAcademicPolicy } from '../../builders/academic-policy.builder';
import { buildCourse } from '../../builders/course.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { creditLoadCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import { planned, S3_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math101, math102, phys201, ind390 } = SYNTHETIC_COURSES;
const LOAD = CheckKind.CreditLoad;
/** The default policy: ruleset `demo-2026.1`, `termCreditBounds: null`. */
const NO_BOUNDS = buildAcademicPolicy();
const BOUNDS_TEXT =
  'planning/08 §Constraint formulation (L ≤ Σ credits ≤ U from institution policy)';
const UNDEFINED_CODE =
  'packages/domain ReasonCode (CREDIT_BOUNDS_UNDEFINED: never a PASS against an assumed load)';
const NO_ASSUMED_FAIL = mustNot(CheckState.Fail, 'must not fail a load against an assumed limit');

/**
 * Expects UNKNOWN `CREDIT_BOUNDS_UNDEFINED` with no credit arithmetic, pinned to the policy.
 *
 * @returns The expected check.
 */
function boundsUndefined(): ReturnType<typeof expectedCheck> {
  return expectedCheck(LOAD, {
    state: CheckState.Unknown,
    reasonCode: ReasonCode.CreditBoundsUndefined,
    sourceRef: 'demo-2026.1:termCreditBounds',
    evidence: { rulesetVersion: 'demo-2026.1', creditLoad: null },
  });
}

/** Cases with no institution-supplied credit bounds. */
export const CREDIT_BOUNDS_UNDEFINED_CASES: readonly GoldenCase[] = [
  creditLoadCase({
    id: 'GC-LOAD-007',
    family: GoldenRuleFamily.CreditBounds,
    title: 'A typical load with no credit bounds is unknown',
    requirementIds: ['FR-06', 'FR-09', 'T04'],
    inputs: {
      selections: [
        planned(math101),
        planned(math102),
        planned(phys201),
        planned(buildCourse({}, 11)),
      ],
      academicPolicy: NO_BOUNDS,
    },
    expected: [boundsUndefined()],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NO_ASSUMED_FAIL],
    rationale:
      '13.00 credits would pass a common 12 to 18 range, but the institution supplied no range. No default is assumed, so the load is unknown and no total is shown against invented limits.',
    citations: [BOUNDS_TEXT, UNDEFINED_CODE, 'PR #124 (bounds from AcademicPolicy)'],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-008',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Missing bounds are reported even with an unchosen variable credit',
    requirementIds: ['FR-06', 'FR-09', 'T04', 'AC18'],
    inputs: {
      selections: [planned(math101), planned(math102), planned(ind390)],
      academicPolicy: NO_BOUNDS,
    },
    expected: [boundsUndefined()],
    allowedAlternatives: [
      [
        expectedCheck(LOAD, {
          state: CheckState.Unknown,
          reasonCode: ReasonCode.VariableCreditUnselected,
        }),
      ],
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NO_ASSUMED_FAIL],
    rationale:
      'Both the bounds and the DEMO-IND 390 credit value are missing. Choosing a value would not settle the load, so the missing bounds are the better reason; either reason keeps it UNKNOWN.',
    citations: [
      BOUNDS_TEXT,
      UNDEFINED_CODE,
      'PR #124 (null bounds reported before an unchosen variable credit)',
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-009',
    family: GoldenRuleFamily.CreditBounds,
    title: 'A heavy load with no credit bounds is unknown, not over a default cap',
    requirementIds: ['FR-06', 'FR-09', 'T04'],
    inputs: {
      selections: [
        planned(math101),
        planned(math102),
        planned(phys201),
        ...[11, 12, 13, 14].map((seed) => planned(buildCourse({}, seed))),
      ],
      academicPolicy: NO_BOUNDS,
    },
    expected: [boundsUndefined()],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NO_ASSUMED_FAIL],
    rationale:
      '22.00 credits is over a common 18-credit cap, but the cap is institutional policy, and none was supplied. Blocking on an assumed cap would be a guess too.',
    citations: [BOUNDS_TEXT, UNDEFINED_CODE],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
];
