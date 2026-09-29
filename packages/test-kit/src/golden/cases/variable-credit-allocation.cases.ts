/**
 * @file Golden cases: allocation with variable-credit candidates, chosen and unchosen, and with
 *   reusable requirements. Room is proven only for every value a student could still choose.
 * @module @caa/test-kit/golden/cases/variable-credit-allocation
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { allocationCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import {
  auditRequirementRef,
  auditWith,
  FRESH_RECORD,
  planned,
  S3_INTERACTIONS_ADJUDICATED_ON,
} from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math102, ind390 } = SYNTHETIC_COURSES;
const ALLOCATES = CheckKind.RequirementAllocation;
const CANDIDATE_SET = 'planning/08 §Candidate formation and allocation (validate the complete set)';
const EXACT_CREDITS =
  'planning/08 §Candidate formation and allocation (exact credit values; do not assume 3 credits)';
const AT_MAXIMUM = 'PR #87 (an unchosen variable credit counts at its maximum)';
const REUSE = 'PR #87 (tech-lead: reuse grants no extra room within a requirement)';
const PASSES = expectedCheck(ALLOCATES, { state: CheckState.Pass, reasonCode: null });
const NOT_BOTH = mustNot(CheckState.Pass, 'must not claim both courses fit the remaining credits');
const NOT_ENGINE_FAIL = mustNot(CheckState.Fail, 'must not decide an allocation the audit owns');
const NO_CONTEST = mustNot(CheckState.Unknown, 'must not invent a contest when every value fits');
/** One requirement listing DEMO-MATH 102 and DEMO-IND 390 with two courses and 5.00 credits left. */
const FIVE_CREDITS_LEFT = {
  candidateCourseIds: [math102.id, ind390.id],
  remainingCourseCount: 2,
  remainingCreditsHundredths: 500,
};
const BOTH_COURSES = [math102.id, ind390.id];

/**
 * Expects one ALLOCATION_CONFLICT on REQ-001 naming both courses.
 *
 * @returns The expected check.
 */
function conflictOnBoth(): ReturnType<typeof expectedCheck> {
  return expectedCheck(ALLOCATES, {
    state: CheckState.Unknown,
    reasonCode: ReasonCode.AllocationConflict,
    sourceRef: auditRequirementRef(1),
    evidence: { courseIds: BOTH_COURSES },
  });
}

/** Allocation × variable credit × reusable cases. DEMO-IND 390 carries 1.00 to 3.00 credits. */
export const VARIABLE_CREDIT_ALLOCATION_CASES: readonly GoldenCase[] = [
  allocationCase({
    id: 'GC-ALLOC-007',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A lone unchosen variable credit fits one remaining 3.00-credit slot',
    requirementIds: ['FR-05', 'T03', 'AC18'],
    inputs: {
      candidates: [planned(ind390)],
      audit: auditWith({ candidateCourseIds: [ind390.id] }),
      freshness: FRESH_RECORD,
    },
    expected: [PASSES],
    prohibitedClaims: [NO_CONTEST],
    rationale:
      'One course and 3.00 credits remain. Whatever value from 1.00 to 3.00 is chosen, it fits, so nothing competes.',
    citations: [CANDIDATE_SET, AT_MAXIMUM, 'planning/13 AC18'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-ALLOC-008',
    family: GoldenRuleFamily.VariableCredit,
    title: 'An unchosen variable credit that could overflow the room conflicts',
    requirementIds: ['FR-05', 'T03', 'AC05', 'AC18'],
    inputs: {
      candidates: [planned(math102), planned(ind390)],
      audit: auditWith(FIVE_CREDITS_LEFT),
      freshness: FRESH_RECORD,
    },
    expected: [conflictOnBoth()],
    prohibitedClaims: [NOT_BOTH, NOT_ENGINE_FAIL],
    rationale:
      '3.00 + 1.00 to 3.00 is 4.00 to 6.00 credits against 5.00 remaining. Some choices fit and some do not, so the fit is not proven.',
    citations: ['planning/13 AC05', 'planning/13 AC18', AT_MAXIMUM, CANDIDATE_SET],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-ALLOC-009',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A chosen 2.00 credits fits the remaining 5.00 exactly',
    requirementIds: ['FR-05', 'T03', 'AC18'],
    inputs: {
      candidates: [planned(math102), planned(ind390, 200)],
      audit: auditWith(FIVE_CREDITS_LEFT),
      freshness: FRESH_RECORD,
    },
    expected: [PASSES],
    prohibitedClaims: [NO_CONTEST],
    rationale:
      '3.00 + 2.00 = 5.00: the chosen value, not the course maximum, fills the remaining credits exactly.',
    citations: ['planning/13 AC18', EXACT_CREDITS, CANDIDATE_SET],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-ALLOC-010',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A chosen 2.01 credits overflows the remaining 5.00 by one hundredth',
    requirementIds: ['FR-05', 'T03', 'AC05', 'AC18'],
    inputs: {
      candidates: [planned(math102), planned(ind390, 201)],
      audit: auditWith(FIVE_CREDITS_LEFT),
      freshness: FRESH_RECORD,
    },
    expected: [conflictOnBoth()],
    prohibitedClaims: [NOT_BOTH, NOT_ENGINE_FAIL],
    rationale: '3.00 + 2.01 = 5.01, one hundredth over the 5.00 remaining; credits are exact.',
    citations: ['planning/13 AC05', EXACT_CREDITS, CANDIDATE_SET],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-ALLOC-011',
    family: GoldenRuleFamily.VariableCredit,
    title: 'Two reusable requirements may share an unchosen variable credit that fits both',
    requirementIds: ['FR-05', 'T03', 'AC18'],
    inputs: {
      candidates: [planned(ind390)],
      audit: auditWith(
        { candidateCourseIds: [ind390.id], isReusable: true },
        { candidateCourseIds: [ind390.id], isReusable: true, label: 'Independent study' },
      ),
      freshness: FRESH_RECORD,
    },
    expected: [PASSES],
    prohibitedClaims: [NO_CONTEST],
    rationale:
      'Both requirements are reusable, so one course may count toward each, and each has room for its maximum 3.00 credits.',
    citations: [
      'issue #57 (a reusable requirement doesn’t conflict on a shared course)',
      AT_MAXIMUM,
    ],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-ALLOC-012',
    family: GoldenRuleFamily.VariableCredit,
    title: 'Reuse grants no room for an unchosen variable credit that could overflow',
    requirementIds: ['FR-05', 'T03', 'AC05', 'AC18'],
    inputs: {
      candidates: [planned(math102), planned(ind390)],
      audit: auditWith({ ...FIVE_CREDITS_LEFT, isReusable: true }),
      freshness: FRESH_RECORD,
    },
    expected: [conflictOnBoth()],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_ENGINE_FAIL],
    rationale:
      'Reuse lets a course also count elsewhere; it does not enlarge this requirement. Up to 6.00 credits against 5.00 is still unproven.',
    citations: [REUSE, AT_MAXIMUM, 'planning/13 AC05'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
];
