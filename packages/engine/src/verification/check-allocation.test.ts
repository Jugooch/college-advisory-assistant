/**
 * @file Tests for the allocation check: staleness, audit states, the requirement tree, and replay.
 */
import { describe, expect, it } from 'vitest';

import type { Course, RequirementResult, RequirementResultInput } from '@caa/domain';
import { buildAuditSnapshot, buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import { CandidateSetInputError, type CourseSelection } from './candidate-set';
import { checkAllocation } from './check-allocation';
import { AuditRecordInputError } from './check-audit-reflects-record';

const { math101, math102, phys201 } = SYNTHETIC_COURSES;
/** The record the default audit ran against, so the audit is fresh. */
const FRESH = { studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00', maxSkewMs: 0 };
/** A record one second newer than the default audit's, beyond a zero skew. */
const STALE = { studentRecordEffectiveAt: '2026-09-20T07:30:01.000-05:00', maxSkewMs: 0 };
const CANDIDATES = [select(math101), select(math102)];

/**
 * Builds a credit-bearing selection with no chosen value.
 *
 * @param course - The course.
 * @returns The selection.
 */
function select(course: Course): CourseSelection {
  return { course, selectedCreditsHundredths: null, countsCredits: true };
}

/**
 * Builds a requirement listing DEMO-MATH 101 and 102 with room for one course.
 *
 * @param overrides - Fields to replace.
 * @param seed - Drives `REQ-00<seed>`.
 * @returns The requirement.
 */
function requirementOf(overrides: Partial<RequirementResultInput>, seed = 1): RequirementResult {
  return buildRequirementResult(
    {
      candidateCourseIds: [math101.id, math102.id],
      remainingCourseCount: 1,
      remainingCreditsHundredths: null,
      ...overrides,
    },
    seed,
  );
}

/**
 * Checks the default candidates against an audit of the given requirements.
 *
 * @param requirements - The audit's requirements.
 * @param freshness - The record and skew; fresh by default.
 * @returns The allocation checks.
 */
function checksOf(requirements: readonly RequirementResult[], freshness = FRESH): unknown {
  return checkAllocation(CANDIDATES, buildAuditSnapshot({ requirements }), freshness);
}

/**
 * Builds one expected check.
 *
 * @param sourceRef - The expected source reference.
 * @param courseIds - The expected courses.
 * @param reasonCode - The expected reason code, omitted for PASS.
 * @returns The expected check result.
 */
function expected(sourceRef: string, courseIds: readonly string[], reasonCode?: string): unknown {
  return {
    kind: 'REQUIREMENT_ALLOCATION',
    state: reasonCode === undefined ? 'PASS' : 'UNKNOWN',
    sourceRef,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    evidence: { rulesetVersion: null, decisiveLeaves: [], courseIds },
  };
}

describe('checkAllocation freshness', () => {
  it('is one UNKNOWN AUDIT_STALE check naming every candidate when the audit is stale', () => {
    expect(checksOf([requirementOf({ remainingCourseCount: 2 })], STALE)).toEqual([
      expected('demo-audit:audit_demo_r1', [math101.id, math102.id], 'AUDIT_STALE'),
    ]);
  });

  it('throws on an invalid skew', () => {
    expect(() => checksOf([requirementOf({})], { ...FRESH, maxSkewMs: -1 })).toThrow(
      AuditRecordInputError,
    );
  });

  it('throws on a malformed candidate set before reading the audit', () => {
    const audit = buildAuditSnapshot({ requirements: [requirementOf({})] });

    expect(() => checkAllocation([select(math101), select(math101)], audit, STALE)).toThrow(
      new CandidateSetInputError('duplicateCourse'),
    );
  });
});

describe('checkAllocation passing sets', () => {
  it('is one PASS check naming every candidate when none compete', () => {
    const requirements = [
      requirementOf({ candidateCourseIds: [math101.id] }, 1),
      requirementOf({ candidateCourseIds: [math102.id] }, 2),
    ];

    expect(checksOf(requirements)).toEqual([
      expected('demo-audit:audit_demo_r1', [math101.id, math102.id]),
    ]);
  });

  it('passes an empty candidate set', () => {
    const audit = buildAuditSnapshot({ requirements: [requirementOf({})] });

    expect(checkAllocation([], audit, FRESH)).toEqual([expected('demo-audit:audit_demo_r1', [])]);
  });

  it('ignores courses the audit does not list', () => {
    const audit = buildAuditSnapshot({ requirements: [requirementOf({})] });

    expect(checkAllocation([select(phys201)], audit, FRESH)).toEqual([
      expected('demo-audit:audit_demo_r1', [phys201.id]),
    ]);
  });
});

describe('checkAllocation audit states', () => {
  it('reports ALLOCATION_CONFLICT for an IN_PROGRESS requirement even with room', () => {
    const requirements = [requirementOf({ state: 'IN_PROGRESS', remainingCourseCount: 2 })];

    expect(checksOf(requirements)).toEqual([
      expected(
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        [math101.id, math102.id],
        'ALLOCATION_CONFLICT',
      ),
    ]);
  });

  it('reports AUDIT_AMBIGUOUS naming an AMBIGUOUS requirement', () => {
    const requirements = [requirementOf({ state: 'AMBIGUOUS', remainingCourseCount: 2 })];

    expect(checksOf(requirements)).toEqual([
      expected(
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        [math101.id, math102.id],
        'AUDIT_AMBIGUOUS',
      ),
    ]);
  });

  it('reports AUDIT_AMBIGUOUS naming the AMBIGUOUS ancestor of a contested requirement', () => {
    const requirements = [
      requirementOf({ state: 'AMBIGUOUS', candidateCourseIds: [], remainingCourseCount: null }, 1),
      requirementOf({ parentSourceRequirementId: 'REQ-001', remainingCourseCount: 2 }, 2),
    ];

    expect(checksOf(requirements)).toEqual([
      expected(
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        [math101.id, math102.id],
        'AUDIT_AMBIGUOUS',
      ),
    ]);
  });

  it('uses the room of an INCOMPLETE requirement under an IN_PROGRESS parent', () => {
    const requirements = [
      requirementOf({ state: 'IN_PROGRESS', candidateCourseIds: [], remainingCourseCount: 3 }, 1),
      requirementOf({ parentSourceRequirementId: 'REQ-001', remainingCourseCount: 2 }, 2),
    ];

    expect(checksOf(requirements)).toEqual([
      expected('demo-audit:audit_demo_r1', [math101.id, math102.id]),
    ]);
  });

  it('leaves a requirement under a COMPLETE parent to applicability', () => {
    const requirements = [
      requirementOf({ state: 'COMPLETE', candidateCourseIds: [], remainingCourseCount: 0 }, 1),
      requirementOf({ parentSourceRequirementId: 'REQ-001' }, 2),
    ];

    expect(checksOf(requirements)).toEqual([
      expected('demo-audit:audit_demo_r1', [math101.id, math102.id]),
    ]);
  });

  it('leaves a COMPLETE requirement to applicability', () => {
    const requirements = [requirementOf({ state: 'COMPLETE', remainingCourseCount: 0 })];

    expect(checksOf(requirements)).toEqual([
      expected('demo-audit:audit_demo_r1', [math101.id, math102.id]),
    ]);
  });
});

describe('checkAllocation with a malformed requirement tree', () => {
  it('reports AUDIT_AMBIGUOUS when a contested requirement names a missing parent', () => {
    const requirements = [requirementOf({ parentSourceRequirementId: 'REQ-999' })];

    const checks = checkAllocation(CANDIDATES, { ...buildAuditSnapshot(), requirements }, FRESH);

    expect(checks).toEqual([
      expected(
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        [math101.id, math102.id],
        'AUDIT_AMBIGUOUS',
      ),
    ]);
  });

  it('stops walking parents that form a cycle', () => {
    const requirements = [
      requirementOf({ candidateCourseIds: [math101.id], parentSourceRequirementId: 'REQ-002' }, 1),
      requirementOf({ candidateCourseIds: [], parentSourceRequirementId: 'REQ-001' }, 2),
    ];

    const checks = checkAllocation(CANDIDATES, { ...buildAuditSnapshot(), requirements }, FRESH);

    expect(checks).toEqual([expected('demo-audit:audit_demo_r1', [math101.id, math102.id])]);
  });
});

describe('checkAllocation replay', () => {
  it('returns deep-equal results for identical inputs', () => {
    const audit = buildAuditSnapshot({
      requirements: [requirementOf({}, 1), requirementOf({ candidateCourseIds: [math101.id] }, 2)],
    });

    const first = checkAllocation(CANDIDATES, audit, FRESH);
    const second = checkAllocation(CANDIDATES, audit, FRESH);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).toEqual(first);
  });
});
