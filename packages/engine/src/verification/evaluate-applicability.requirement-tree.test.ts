/**
 * @file Tests that applicability reads each requirement's own state in a parent/child tree.
 */
import { describe, expect, it } from 'vitest';

import type { RequirementResultInput } from '@caa/domain';
import { buildAuditSnapshot, buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import { evaluateApplicability } from './evaluate-applicability';

const CALC_ID = SYNTHETIC_COURSES.math101.id;
const FRESH = { studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00', maxSkewMs: 0 };
const OUTSTANDING = { remainingCourseCount: 1, remainingCreditsHundredths: 300 };
const SATISFIED = { remainingCourseCount: 0, remainingCreditsHundredths: 0 };

/**
 * Evaluates DEMO-MATH 101 against a parent `REQ-001` and its child `REQ-002`.
 *
 * @param parent - Fields of the parent requirement.
 * @param child - Fields of the child requirement.
 * @returns The check's state, reason code, and source reference.
 */
function checkOf(
  parent: Partial<RequirementResultInput>,
  child: Partial<RequirementResultInput>,
): unknown {
  const audit = buildAuditSnapshot({
    requirements: [
      buildRequirementResult(parent, 1),
      buildRequirementResult({ ...child, parentSourceRequirementId: 'REQ-001' }, 2),
    ],
  });
  const check = evaluateApplicability(CALC_ID, audit, FRESH);
  return { state: check.state, reasonCode: check.reasonCode, sourceRef: check.sourceRef };
}

describe('evaluateApplicability in a requirement tree', () => {
  it('fails on a COMPLETE parent that lists the course, whatever its INCOMPLETE child says', () => {
    const parent = { state: 'COMPLETE', candidateCourseIds: [CALC_ID], ...SATISFIED } as const;
    const child = { state: 'INCOMPLETE', candidateCourseIds: [], ...OUTSTANDING } as const;

    expect(checkOf(parent, child)).toEqual({
      state: 'FAIL',
      reasonCode: 'REQUIREMENT_ALREADY_SATISFIED',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('passes on an INCOMPLETE child that lists the course, under a COMPLETE parent', () => {
    const parent = { state: 'COMPLETE', candidateCourseIds: [], ...SATISFIED } as const;
    const child = { state: 'INCOMPLETE', candidateCourseIds: [CALC_ID], ...OUTSTANDING } as const;

    expect(checkOf(parent, child)).toEqual({
      state: 'PASS',
      reasonCode: undefined,
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-002',
    });
  });

  it('passes on an INCOMPLETE parent that lists the course, though its only child is COMPLETE', () => {
    const parent = { state: 'INCOMPLETE', candidateCourseIds: [CALC_ID], ...OUTSTANDING } as const;
    const child = { state: 'COMPLETE', candidateCourseIds: [], ...SATISFIED } as const;

    expect(checkOf(parent, child)).toEqual({
      state: 'PASS',
      reasonCode: undefined,
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
    });
  });

  it('fails with NOT_APPLICABLE when only the child lists an equivalent, not the course', () => {
    const parent = { state: 'INCOMPLETE', candidateCourseIds: [], ...OUTSTANDING } as const;
    const child = {
      state: 'INCOMPLETE',
      candidateCourseIds: [SYNTHETIC_COURSES.math111.id],
      ...OUTSTANDING,
    } as const;

    expect(checkOf(parent, child)).toEqual({
      state: 'FAIL',
      reasonCode: 'NOT_APPLICABLE',
      sourceRef: 'demo-audit:audit_demo_r1',
    });
  });

  it('is UNKNOWN on an AMBIGUOUS child that lists the course, under an INCOMPLETE parent that does too', () => {
    const parent = { state: 'INCOMPLETE', candidateCourseIds: [CALC_ID], ...OUTSTANDING } as const;
    const child = { state: 'AMBIGUOUS', candidateCourseIds: [CALC_ID], ...OUTSTANDING } as const;

    expect(checkOf(parent, child)).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_AMBIGUOUS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-002',
    });
  });
});
