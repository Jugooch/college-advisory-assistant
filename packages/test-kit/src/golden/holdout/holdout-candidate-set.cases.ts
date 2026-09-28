/**
 * @file Frozen holdout cases for applicability, allocation, and credit load. Kept out of engine
 *   development; see README.md in this folder before reading further.
 * @module @caa/test-kit/golden/holdout/holdout-candidate-set
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, RequirementState } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { allocationCase, applicabilityCase, creditLoadCase } from '../golden-case-factories';
import { expectedCheck, mustNot } from '../golden-expectations';
import { auditRequirementRef, auditWith, FRESH_RECORD, planned } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math101, math102, phys201, ind390 } = SYNTHETIC_COURSES;

/** Holdout applicability, allocation, and credit-load cases. */
export const HOLDOUT_CANDIDATE_SET_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GH-APP-001',
    family: GoldenRuleFamily.Applicability,
    title: 'An outstanding requirement elsewhere still applies',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith(
        {
          state: RequirementState.Complete,
          remainingCreditsHundredths: 0,
          remainingCourseCount: 0,
        },
        { label: 'Quantitative reasoning' },
      ),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(CheckKind.RequirementApplicability, {
        state: CheckState.Pass,
        reasonCode: null,
        sourceRef: auditRequirementRef(2),
      }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Fail, 'must not deny an outstanding requirement the audit lists'),
    ],
    rationale: 'REQ-001 is complete, but the separate REQ-002 is outstanding and lists the course.',
    citations: [
      'issue #56 (INCOMPLETE → PASS naming the requirement)',
      'planning/08 §Authority and result semantics',
    ],
  }),
  allocationCase({
    id: 'GH-ALLOC-001',
    family: GoldenRuleFamily.Allocation,
    title: 'An unchosen variable credit fits when its maximum fits',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      candidates: [planned(math102), planned(ind390)],
      audit: auditWith({
        candidateCourseIds: [math102.id, ind390.id],
        remainingCourseCount: 2,
        remainingCreditsHundredths: 600,
      }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(CheckKind.RequirementAllocation, { state: CheckState.Pass, reasonCode: null }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Unknown, 'must not invent a contest when every value fits'),
    ],
    rationale:
      'Two courses and 6.00 credits remain; 3.00 plus at most 3.00 fits for any chosen value.',
    citations: ['planning/08 §Candidate formation and allocation', 'issue #57'],
  }),
  creditLoadCase({
    id: 'GH-LOAD-001',
    family: GoldenRuleFamily.CreditBounds,
    title: 'Equal minimum and maximum admit exactly one load',
    requirementIds: ['FR-06', 'T04'],
    inputs: {
      selections: [planned(math101), planned(phys201), planned(math102), planned(ind390, 100)],
      bounds: {
        minCreditsHundredths: 1100,
        maxCreditsHundredths: 1100,
        sourceRef: 'demo-load-policy-fixed',
      },
    },
    expected: [
      expectedCheck(CheckKind.CreditLoad, {
        state: CheckState.Pass,
        reasonCode: null,
        evidence: {
          creditLoad: {
            totalCreditsHundredths: 1100,
            minCreditsHundredths: 1100,
            maxCreditsHundredths: 1100,
          },
        },
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not reject the one permitted load')],
    rationale: '3.00 + 4.00 + 3.00 + 1.00 = 11.00, exactly the fixed load.',
    citations: ['planning/08 §Constraint formulation (L ≤ Σ credits ≤ U)'],
  }),
];
