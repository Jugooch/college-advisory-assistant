/**
 * @file Acceptance: two requirements competing for the same non-reusable course are never both
 *   marked satisfied.
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { AggregateState, CheckState, ReasonCode } from '@caa/domain';
import { aggregateCheckStates, checkAllocation } from '@caa/engine';
import { auditWith, FRESH_RECORD, planned, SYNTHETIC_COURSES } from '@caa/test-kit';

const { math102, phys201 } = SYNTHETIC_COURSES;

describe('AC05 competing requirements are not both satisfied', () => {
  it('reports each requirement competing for one non-reusable course as UNKNOWN ALLOCATION_CONFLICT', () => {
    const audit = auditWith(
      { candidateCourseIds: [math102.id] },
      { candidateCourseIds: [math102.id], label: 'Quantitative reasoning' },
    );

    const checks = checkAllocation([planned(math102)], audit, FRESH_RECORD);

    expect(checks.map((check) => [check.state, check.reasonCode, check.sourceRef])).toEqual([
      [
        CheckState.Unknown,
        ReasonCode.AllocationConflict,
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
      ],
      [
        CheckState.Unknown,
        ReasonCode.AllocationConflict,
        'demo-audit:audit_demo_r1:demo-audit/REQ-002',
      ],
    ]);
  });

  it('never validates two courses for one remaining slot', () => {
    const audit = auditWith({
      candidateCourseIds: [math102.id, phys201.id],
      remainingCourseCount: 1,
      remainingCreditsHundredths: 300,
    });

    const checks = checkAllocation([planned(math102), planned(phys201)], audit, FRESH_RECORD);

    expect(checks).toMatchObject([
      {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AllocationConflict,
        evidence: { courseIds: [math102.id, phys201.id] },
      },
    ]);
    expect(aggregateCheckStates(checks.map((check) => check.state))).toBe(
      AggregateState.NeedsVerification,
    );
  });
});
