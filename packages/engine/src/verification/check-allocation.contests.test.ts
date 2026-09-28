/**
 * @file Tests for allocation contests: requirement room, shared courses, reuse, and order.
 */
import { describe, expect, it } from 'vitest';

import type { Course, CourseId, RequirementResult, RequirementResultInput } from '@caa/domain';
import { buildAuditSnapshot, buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import type { CourseSelection } from './candidate-set';
import { checkAllocation } from './check-allocation';

const { math101, math102, phys201, ind390 } = SYNTHETIC_COURSES;
const FRESH = { studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00', maxSkewMs: 0 };
const PASS = [{ state: 'PASS', sourceRef: 'demo-audit:audit_demo_r1', reasonCode: undefined }];

/**
 * Builds a credit-bearing selection.
 *
 * @param course - The course.
 * @param selectedCreditsHundredths - The chosen credit value, or `null`.
 * @returns The selection.
 */
function select(course: Course, selectedCreditsHundredths: number | null = null): CourseSelection {
  return { course, selectedCreditsHundredths, countsCredits: true };
}

/**
 * Builds an INCOMPLETE requirement with no remaining quantity unless overridden.
 *
 * @param candidateCourseIds - The courses it lists.
 * @param overrides - Fields to replace.
 * @param seed - Drives `REQ-00<seed>`.
 * @returns The requirement.
 */
function requirementOf(
  candidateCourseIds: readonly CourseId[],
  overrides: Partial<RequirementResultInput>,
  seed = 1,
): RequirementResult {
  return buildRequirementResult(
    {
      candidateCourseIds,
      remainingCourseCount: null,
      remainingCreditsHundredths: null,
      ...overrides,
    },
    seed,
  );
}

/**
 * Summarizes the allocation checks of a candidate set.
 *
 * @param candidates - The candidate set.
 * @param requirements - The audit's requirements.
 * @returns Each check's state, source reference, reason code, and courses.
 */
function summarize(
  candidates: readonly CourseSelection[],
  requirements: readonly RequirementResult[],
): unknown {
  const checks = checkAllocation(candidates, buildAuditSnapshot({ requirements }), FRESH);
  return checks.map((check) => ({
    state: check.state,
    sourceRef: check.sourceRef,
    reasonCode: check.reasonCode,
    ...(check.state === 'PASS' ? {} : { courseIds: check.evidence?.courseIds }),
  }));
}

/**
 * Builds an expected ALLOCATION_CONFLICT summary.
 *
 * @param seed - The contested requirement's seed.
 * @param courseIds - The expected competing courses.
 * @returns The summary.
 */
function conflict(seed: number, courseIds: readonly CourseId[]): unknown {
  return {
    state: 'UNKNOWN',
    sourceRef: `demo-audit:audit_demo_r1:demo-audit/REQ-00${String(seed)}`,
    reasonCode: 'ALLOCATION_CONFLICT',
    courseIds,
  };
}

const TWO_MATH = [select(math101), select(math102)];
const MATH_IDS = [math101.id, math102.id];

describe('checkAllocation requirement room', () => {
  it('conflicts when two candidates need a requirement with one course left (AC05)', () => {
    const requirements = [requirementOf(MATH_IDS, { remainingCourseCount: 1 })];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });

  it('passes when the remaining course count holds every candidate', () => {
    const requirements = [requirementOf(MATH_IDS, { remainingCourseCount: 2 })];

    expect(summarize(TWO_MATH, requirements)).toEqual(PASS);
  });

  it('conflicts when the candidates credits exceed the remaining credits', () => {
    const requirements = [requirementOf(MATH_IDS, { remainingCreditsHundredths: 599 })];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });

  it('passes when the remaining credits hold every candidate exactly', () => {
    const requirements = [requirementOf(MATH_IDS, { remainingCreditsHundredths: 600 })];

    expect(summarize(TWO_MATH, requirements)).toEqual(PASS);
  });

  it('conflicts when the course count fits but the credits do not', () => {
    const requirements = [
      requirementOf(MATH_IDS, { remainingCourseCount: 2, remainingCreditsHundredths: 500 }),
    ];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });

  it('conflicts when the requirement states no remaining quantity, which is unknown room', () => {
    const requirements = [requirementOf(MATH_IDS, {})];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });

  it('counts an unchosen variable credit value at its maximum', () => {
    const ids = [math102.id, ind390.id];
    const requirements = [requirementOf(ids, { remainingCreditsHundredths: 500 })];

    expect(summarize([select(math102), select(ind390)], requirements)).toEqual([conflict(1, ids)]);
    expect(summarize([select(math102), select(ind390, 200)], requirements)).toEqual(PASS);
  });

  it('conflicts over room even when the requirement is reusable', () => {
    const requirements = [requirementOf(MATH_IDS, { remainingCourseCount: 1, isReusable: true })];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });

  it('names competing courses in candidate-set order', () => {
    const requirements = [requirementOf([math102.id, math101.id], { remainingCourseCount: 1 })];

    expect(summarize(TWO_MATH, requirements)).toEqual([conflict(1, MATH_IDS)]);
  });
});

describe('checkAllocation shared courses', () => {
  it('conflicts on both requirements that list one non-reusable course (AC05)', () => {
    const requirements = [
      requirementOf([math101.id], { remainingCourseCount: 1 }, 1),
      requirementOf([math101.id], { remainingCourseCount: 1 }, 2),
    ];

    expect(summarize([select(math101)], requirements)).toEqual([
      conflict(1, [math101.id]),
      conflict(2, [math101.id]),
    ]);
  });

  it('conflicts when only one of the requirements allows reuse', () => {
    const requirements = [
      requirementOf([math101.id], { remainingCourseCount: 1, isReusable: true }, 1),
      requirementOf([math101.id], { remainingCourseCount: 1 }, 2),
    ];

    expect(summarize([select(math101)], requirements)).toEqual([
      conflict(1, [math101.id]),
      conflict(2, [math101.id]),
    ]);
  });

  it('passes a course shared by requirements that both allow reuse', () => {
    const requirements = [
      requirementOf([math101.id], { remainingCourseCount: 1, isReusable: true }, 1),
      requirementOf([math101.id], { remainingCourseCount: 1, isReusable: true }, 2),
    ];

    expect(summarize([select(math101)], requirements)).toEqual(PASS);
  });

  it('names only the shared course when the requirement has room for the rest', () => {
    const requirements = [
      requirementOf([math101.id, phys201.id], { remainingCourseCount: 2 }, 1),
      requirementOf([math101.id], { remainingCourseCount: 1 }, 2),
    ];

    expect(summarize([select(phys201), select(math101)], requirements)).toEqual([
      conflict(1, [math101.id]),
      conflict(2, [math101.id]),
    ]);
  });

  it('passes a course listed by a requirement and its own ancestor', () => {
    const requirements = [
      requirementOf([math101.id], { remainingCourseCount: 2 }, 1),
      requirementOf(
        [math101.id],
        { remainingCourseCount: 1, parentSourceRequirementId: 'REQ-001' },
        2,
      ),
    ];

    expect(summarize([select(math101)], requirements)).toEqual(PASS);
  });

  it('passes a course whose other requirement is already COMPLETE', () => {
    const requirements = [
      requirementOf([math101.id], { remainingCourseCount: 1 }, 1),
      requirementOf([math101.id], { state: 'COMPLETE', remainingCourseCount: 0 }, 2),
    ];

    expect(summarize([select(math101)], requirements)).toEqual(PASS);
  });
});
