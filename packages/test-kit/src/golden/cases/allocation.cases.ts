/**
 * @file Golden cases: candidate courses competing for audit requirements, including reusable
 *   requirements, unknown remaining quantities, and a stale audit.
 * @module @caa/test-kit/golden/cases/allocation
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { allocationCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import { auditRequirementRef, auditWith, FRESH_RECORD, planned } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math102, phys201 } = SYNTHETIC_COURSES;
const ALLOCATES = CheckKind.RequirementAllocation;
const CANDIDATE_SET = 'planning/08 §Candidate formation and allocation (validate the complete set)';
const BOTH = [planned(math102), planned(phys201)];
const BOTH_LISTED = { candidateCourseIds: [math102.id, phys201.id] };
const NOT_BOTH = mustNot(CheckState.Pass, 'must not mark both courses as satisfying one slot');
const NOT_ENGINE_FAIL = mustNot(CheckState.Fail, 'must not decide an allocation the audit owns');
const SHARED = [
  { candidateCourseIds: [math102.id] },
  { candidateCourseIds: [math102.id], label: 'Quantitative reasoning' },
];

/**
 * Expects one ALLOCATION_CONFLICT naming the courses and the requirement.
 *
 * @param requirementNumber - The contested requirement's seed.
 * @param courseIds - The competing courses, in candidate-set order.
 * @returns The expected check.
 */
function conflict(
  requirementNumber: number,
  courseIds: readonly string[],
): ReturnType<typeof expectedCheck> {
  return expectedCheck(ALLOCATES, {
    state: CheckState.Unknown,
    reasonCode: ReasonCode.AllocationConflict,
    sourceRef: auditRequirementRef(requirementNumber),
    evidence: { courseIds },
  });
}

/** Allocation cases. */
export const ALLOCATION_CASES: readonly GoldenCase[] = [
  allocationCase({
    id: 'GC-ALLOC-001',
    family: GoldenRuleFamily.Allocation,
    title: 'Two candidates for one remaining course conflict',
    requirementIds: ['FR-05', 'T03', 'AC05'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: 1,
        remainingCreditsHundredths: 300,
      }),
      freshness: FRESH_RECORD,
    },
    expected: [conflict(1, [math102.id, phys201.id])],
    prohibitedClaims: [NOT_BOTH, NOT_ENGINE_FAIL],
    rationale:
      'One course remains, so the audit can count only one of the two; the engine names both instead of choosing.',
    citations: [
      'planning/13 AC05',
      CANDIDATE_SET,
      'issue #57 (remaining quantity cannot absorb all)',
    ],
  }),
  allocationCase({
    id: 'GC-ALLOC-002',
    family: GoldenRuleFamily.Allocation,
    title: 'Two candidates fit a requirement with room for both',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: 2,
        remainingCreditsHundredths: 700,
      }),
      freshness: FRESH_RECORD,
    },
    expected: [expectedCheck(ALLOCATES, { state: CheckState.Pass, reasonCode: null })],
    prohibitedClaims: [mustNot(CheckState.Unknown, 'must not invent a contest when both fit')],
    rationale: 'Two courses and 7.00 credits remain; 3.00 + 4.00 fit exactly, so nothing competes.',
    citations: [CANDIDATE_SET, 'issue #57'],
  }),
  allocationCase({
    id: 'GC-ALLOC-003',
    family: GoldenRuleFamily.Allocation,
    title: 'A reusable requirement with too little room still conflicts',
    requirementIds: ['FR-05', 'T03', 'AC05'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        isReusable: true,
        remainingCourseCount: 1,
        remainingCreditsHundredths: 300,
      }),
      freshness: FRESH_RECORD,
    },
    expected: [conflict(1, [math102.id, phys201.id])],
    prohibitedClaims: [NOT_BOTH, NOT_ENGINE_FAIL],
    rationale:
      'Reuse lets a course also count elsewhere; it grants no extra room within this requirement.',
    citations: ['PR #87 (tech-lead: reusable over-room still ALLOCATION_CONFLICT)', CANDIDATE_SET],
  }),
  allocationCase({
    id: 'GC-ALLOC-004',
    family: GoldenRuleFamily.Allocation,
    title: 'Two requirements compete for one non-reusable course',
    requirementIds: ['FR-05', 'T03', 'AC05'],
    inputs: {
      candidates: [planned(math102)],
      audit: auditWith(...SHARED),
      freshness: FRESH_RECORD,
    },
    expected: [conflict(1, [math102.id]), conflict(2, [math102.id])],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not mark both requirements satisfied by one course'),
      NOT_ENGINE_FAIL,
    ],
    rationale:
      'A non-reusable course counts once; each requirement it could fill is named as contested.',
    citations: [
      'planning/13 AC05',
      CANDIDATE_SET,
      'issue #57 (naming the courses and the requirement)',
    ],
  }),
  allocationCase({
    id: 'GC-ALLOC-005',
    family: GoldenRuleFamily.Allocation,
    title: 'Two reusable requirements may share one course',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      candidates: [planned(math102)],
      audit: auditWith(...SHARED.map((shared) => ({ ...shared, isReusable: true }))),
      freshness: FRESH_RECORD,
    },
    expected: [expectedCheck(ALLOCATES, { state: CheckState.Pass, reasonCode: null })],
    prohibitedClaims: [mustNot(CheckState.Unknown, 'must not contest reuse the audit permits')],
    rationale: 'Both requirements permit reuse, so one course may count toward each.',
    citations: ['issue #57 (a reusable requirement does not conflict)', CANDIDATE_SET],
  }),
  allocationCase({
    id: 'GC-ALLOC-006',
    family: GoldenRuleFamily.Allocation,
    title: 'Unknown remaining quantities are not unlimited room',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: null,
        remainingCreditsHundredths: null,
      }),
      freshness: FRESH_RECORD,
    },
    expected: [conflict(1, [math102.id, phys201.id])],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_ENGINE_FAIL],
    rationale:
      'The audit states no remaining quantity, so whether both fit is unknown, never assumed.',
    citations: [
      'planning/08 §Authority and result semantics (missing data → UNKNOWN)',
      'PR #87 (null remaining = unknown)',
    ],
  }),
  allocationCase({
    id: 'GC-STALE-003',
    family: GoldenRuleFamily.AuditStale,
    title: 'A stale audit makes allocation unknown',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: 2,
        remainingCreditsHundredths: 700,
      }),
      freshness: { studentRecordEffectiveAt: '2026-09-20T07:30:00.001-05:00', maxSkewMs: 0 },
    },
    expected: [
      expectedCheck(ALLOCATES, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_ENGINE_FAIL],
    rationale:
      "The record changed 1 ms after the audit's record with no skew allowed: refresh, never mix snapshots.",
    citations: ['planning/13 AC10', 'issue #56 (stale snapshot never passes)'],
  }),
];
