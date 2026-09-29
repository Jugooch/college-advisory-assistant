/**
 * @file Golden cases: a candidate set's credit total against the term's bounds, included linked
 *   sections, and variable-credit courses.
 * @module @caa/test-kit/golden/cases/credit-load
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { buildCourse } from '../../builders/course.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { creditLoadCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import { loadPolicy, planned, S3_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math101, math102, phys201, phys201Lab, ind390 } = SYNTHETIC_COURSES;
const LOAD = CheckKind.CreditLoad;
/** The policy of ruleset `demo-2026.1` with term credit bounds 12.00 to 18.00. */
const POLICY = loadPolicy(1200, 1800);
/** The bounds' reference: they belong to the `demo-2026.1` ruleset's policy. */
const POLICY_REF = 'demo-2026.1:termCreditBounds';
const BOUNDS_TEXT = 'planning/08 §Constraint formulation (L ≤ Σ credits ≤ U, exact values)';
const PINNED_POLICY =
  'planning/08 §Evidence contract example (source_ref and ruleset_version pin the result); PR #124 (bounds from the policy, `<ruleset>:termCreditBounds`)';
/** DEMO-MATH 101, DEMO-MATH 102, DEMO-PHYS 201: 3.00 + 3.00 + 4.00 = 10.00 credits. */
const TEN_CREDITS = [planned(math101), planned(math102), planned(phys201)];
/** Ten credits plus two generic 3.00-credit courses: 16.00 credits. */
const SIXTEEN_CREDITS = [
  ...TEN_CREDITS,
  planned(buildCourse({}, 11)),
  planned(buildCourse({}, 12)),
];
const NOT_WITHIN = mustNot(CheckState.Pass, 'must not claim the load is within the bounds');
const NOT_OVER = mustNot(CheckState.Fail, 'must not reject a load within the bounds');

/**
 * Expects a CREDIT_LOAD check with its arithmetic against the default 12.00–18.00 bounds.
 *
 * @param state - The expected state.
 * @param reasonCode - The expected reason, `null` for PASS.
 * @param totalCreditsHundredths - The expected total, written out literally.
 * @returns The expected check.
 */
function load(
  state: CheckState,
  reasonCode: ReasonCode | null,
  totalCreditsHundredths: number,
): ReturnType<typeof expectedCheck> {
  return expectedCheck(LOAD, {
    state,
    reasonCode,
    sourceRef: POLICY_REF,
    evidence: {
      rulesetVersion: 'demo-2026.1',
      creditLoad: {
        totalCreditsHundredths,
        minCreditsHundredths: 1200,
        maxCreditsHundredths: 1800,
      },
    },
  });
}

/** Credit-bound and variable-credit cases. Bounds are 12.00 to 18.00 credits unless stated. */
export const CREDIT_LOAD_CASES: readonly GoldenCase[] = [
  creditLoadCase({
    id: 'GC-LOAD-001',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Mixed 3, 4, 1 and chosen 3 credits sum to 14.00',
    requirementIds: ['FR-06', 'T04'],
    inputs: {
      selections: [...TEN_CREDITS, planned(phys201Lab), planned(ind390, 300)],
      academicPolicy: POLICY,
    },
    expected: [load(CheckState.Pass, null, 1400)],
    prohibitedClaims: [NOT_OVER],
    rationale:
      '3.00 + 3.00 + 4.00 + 1.00 (a lab with its own credit) + 3.00 = 14.00; not every course is three credits.',
    citations: [BOUNDS_TEXT, 'issue #57 (sums exact hundredths)', PINNED_POLICY],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-002',
    family: GoldenRuleFamily.CreditBounds,
    title: 'One hundredth over the maximum fails',
    requirementIds: ['FR-06', 'T04'],
    inputs: { selections: [...SIXTEEN_CREDITS, planned(ind390, 201)], academicPolicy: POLICY },
    expected: [load(CheckState.Fail, ReasonCode.CreditLimitExceeded, 1801)],
    prohibitedClaims: [NOT_WITHIN],
    rationale: '16.00 + 2.01 = 18.01 exceeds 18.00; scaled integers keep the hundredth.',
    citations: [
      BOUNDS_TEXT,
      'issue #57 (above the maximum → CREDIT_LIMIT_EXCEEDED)',
      PINNED_POLICY,
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-003',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Exactly the maximum passes',
    requirementIds: ['FR-06', 'T04'],
    inputs: { selections: [...SIXTEEN_CREDITS, planned(ind390, 200)], academicPolicy: POLICY },
    expected: [load(CheckState.Pass, null, 1800)],
    prohibitedClaims: [NOT_OVER],
    rationale: 'L ≤ Σ ≤ U is inclusive: 18.00 is within 12.00 to 18.00.',
    citations: [BOUNDS_TEXT, PINNED_POLICY],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-004',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Ten credits is below a twelve-credit minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: { selections: TEN_CREDITS, academicPolicy: POLICY },
    expected: [load(CheckState.Fail, ReasonCode.CreditBelowMinimum, 1000)],
    prohibitedClaims: [NOT_WITHIN],
    rationale: '10.00 is under the 12.00 minimum load.',
    citations: [BOUNDS_TEXT, 'issue #57 (below the minimum → CREDIT_BELOW_MINIMUM)', PINNED_POLICY],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-005',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Exactly the minimum passes',
    requirementIds: ['FR-06', 'T04'],
    inputs: { selections: [...TEN_CREDITS, planned(ind390, 200)], academicPolicy: POLICY },
    expected: [load(CheckState.Pass, null, 1200)],
    prohibitedClaims: [NOT_OVER],
    rationale: '10.00 + 2.00 = 12.00 meets the inclusive minimum.',
    citations: [BOUNDS_TEXT, PINNED_POLICY],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-LOAD-006',
    family: GoldenRuleFamily.CreditBounds,
    title: 'A lab included in its lecture is not counted twice',
    requirementIds: ['FR-06', 'T04'],
    inputs: {
      selections: [...TEN_CREDITS, planned(phys201Lab, null, false), planned(buildCourse({}, 11))],
      academicPolicy: loadPolicy(1200, 1300),
    },
    expected: [
      expectedCheck(LOAD, {
        state: CheckState.Pass,
        reasonCode: null,
        evidence: {
          creditLoad: {
            totalCreditsHundredths: 1300,
            minCreditsHundredths: 1200,
            maxCreditsHundredths: 1300,
          },
        },
      }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Fail, 'must not double-count a lab its lecture already includes'),
    ],
    rationale:
      '13.00 without the included lab; counting its 1.00 again would give 14.00 and a false over-limit.',
    citations: ['planning/08 §Constraint formulation (no double-counting labs)', 'issue #57'],
  }),
  creditLoadCase({
    id: 'GC-VAR-001',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A variable-credit course with no chosen value is unknown',
    requirementIds: ['FR-06', 'T04', 'AC18'],
    inputs: { selections: [...TEN_CREDITS, planned(ind390)], academicPolicy: POLICY },
    expected: [
      expectedCheck(LOAD, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.VariableCreditUnselected,
        evidence: { courseIds: [ind390.id], creditLoad: null },
      }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not reject a load that could fit'),
    ],
    rationale:
      'DEMO-IND 390 carries 1.00 to 3.00 credits; 11.00 to 13.00 total straddles the minimum, so the load is unknown.',
    citations: [
      'planning/13 AC18',
      'issue #57 (VARIABLE_CREDIT_UNSELECTED)',
      'issue #85 (creditLoad null when unknown)',
    ],
  }),
  creditLoadCase({
    id: 'GC-VAR-002',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A chosen 1.50 credits is counted exactly',
    requirementIds: ['FR-06', 'T04', 'AC18'],
    inputs: {
      selections: [...TEN_CREDITS, planned(buildCourse({}, 11)), planned(ind390, 150)],
      academicPolicy: POLICY,
    },
    expected: [load(CheckState.Pass, null, 1450)],
    prohibitedClaims: [NOT_OVER],
    rationale:
      '13.00 + 1.50 = 14.50: the selected value, not the minimum, maximum, or a default of 3.00.',
    citations: ['planning/13 AC18', BOUNDS_TEXT, PINNED_POLICY],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  creditLoadCase({
    id: 'GC-VAR-003',
    family: GoldenRuleFamily.VariableCredit,
    title: 'Fixed credits alone over the cap with an unchosen value',
    requirementIds: ['FR-06', 'T04', 'AC18'],
    inputs: {
      selections: [...SIXTEEN_CREDITS, planned(buildCourse({}, 13)), planned(ind390)],
      academicPolicy: POLICY,
    },
    expected: [
      expectedCheck(LOAD, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.VariableCreditUnselected,
      }),
    ],
    allowedAlternatives: [
      [expectedCheck(LOAD, { state: CheckState.Fail, reasonCode: ReasonCode.CreditLimitExceeded })],
    ],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not claim a 20.00 to 22.00 load is within an 18.00 cap'),
    ],
    rationale:
      '19.00 fixed already exceeds 18.00. UNKNOWN (value unchosen) and FAIL (over for every value) are both safe.',
    citations: [
      'planning/13 AC18',
      BOUNDS_TEXT,
      'PR #87 (unselected stays UNKNOWN even over the cap)',
    ],
  }),
];
