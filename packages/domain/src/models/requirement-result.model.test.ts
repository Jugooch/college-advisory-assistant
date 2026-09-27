/**
 * @file Tests for the requirement result data object.
 */
import { describe, expect, it } from 'vitest';

import { RequirementState } from '../enums/requirement-state.enum';
import {
  createRequirementResult,
  type RequirementResultInput,
  RequirementResultSchema,
} from './requirement-result.model';

const ATTEMPT_1 = '5e6f7081-0000-4000-8000-000000000001';
const ATTEMPT_2 = '5e6f7081-0000-4000-8000-000000000002';
const COURSE_1 = '3c4d5e6f-0000-4000-8000-000000000001';
const COURSE_2 = '3c4d5e6f-0000-4000-8000-000000000002';

const INCOMPLETE: RequirementResultInput = {
  sourceRequirementId: 'demo.math.core',
  parentSourceRequirementId: 'demo.core',
  label: 'Mathematics core',
  state: RequirementState.Incomplete,
  allocatedAttemptIds: [ATTEMPT_1],
  remainingCreditsHundredths: 350,
  remainingCourseCount: 1,
  candidateCourseIds: [COURSE_1, COURSE_2],
  isReusable: false,
  sourceRef: 'audit_demo_r7:item12',
};

const COMPLETE: RequirementResultInput = {
  ...INCOMPLETE,
  state: RequirementState.Complete,
  allocatedAttemptIds: [ATTEMPT_1, ATTEMPT_2],
  remainingCreditsHundredths: 0,
  remainingCourseCount: 0,
  candidateCourseIds: [],
};

describe('createRequirementResult', () => {
  it('accepts an incomplete requirement with a remainder and candidates', () => {
    expect(createRequirementResult(INCOMPLETE)).toEqual({
      sourceRequirementId: 'demo.math.core',
      parentSourceRequirementId: 'demo.core',
      label: 'Mathematics core',
      state: 'INCOMPLETE',
      allocatedAttemptIds: ['5e6f7081-0000-4000-8000-000000000001'],
      remainingCreditsHundredths: 350,
      remainingCourseCount: 1,
      candidateCourseIds: [
        '3c4d5e6f-0000-4000-8000-000000000001',
        '3c4d5e6f-0000-4000-8000-000000000002',
      ],
      isReusable: false,
      sourceRef: 'audit_demo_r7:item12',
    });
  });

  it('accepts a complete requirement with zero remaining', () => {
    expect(createRequirementResult(COMPLETE).state).toBe('COMPLETE');
  });

  it('accepts a complete requirement whose remainder is not measured', () => {
    const result = createRequirementResult({
      ...COMPLETE,
      remainingCreditsHundredths: null,
      remainingCourseCount: null,
    });

    expect(result.remainingCreditsHundredths).toBeNull();
    expect(result.remainingCourseCount).toBeNull();
  });

  it('accepts an ambiguous requirement with nothing allocated', () => {
    const result = createRequirementResult({
      ...INCOMPLETE,
      state: RequirementState.Ambiguous,
      allocatedAttemptIds: [],
      remainingCreditsHundredths: null,
      remainingCourseCount: null,
    });

    expect(result.state).toBe('AMBIGUOUS');
  });

  it('rejects a complete requirement with remaining credits', () => {
    expect(() => createRequirementResult({ ...COMPLETE, remainingCreditsHundredths: 100 })).toThrow(
      /COMPLETE requirement must not have a remaining quantity/,
    );
  });

  it('rejects a complete requirement with a remaining course', () => {
    expect(() => createRequirementResult({ ...COMPLETE, remainingCourseCount: 1 })).toThrow(
      /COMPLETE requirement must not have a remaining quantity/,
    );
  });

  it('rejects a repeated allocated attempt', () => {
    expect(() =>
      createRequirementResult({ ...INCOMPLETE, allocatedAttemptIds: [ATTEMPT_1, ATTEMPT_1] }),
    ).toThrow(/must not repeat an attempt/);
  });

  it('rejects a repeated candidate course', () => {
    expect(() =>
      createRequirementResult({ ...INCOMPLETE, candidateCourseIds: [COURSE_2, COURSE_2] }),
    ).toThrow(/must not repeat a course/);
  });

  it('rejects fractional remaining credits, because credits are scaled integers', () => {
    expect(() =>
      createRequirementResult({ ...INCOMPLETE, remainingCreditsHundredths: 3.5 }),
    ).toThrow();
  });

  it('rejects a negative remaining course count', () => {
    expect(() => createRequirementResult({ ...INCOMPLETE, remainingCourseCount: -1 })).toThrow();
  });

  it('rejects an allocated attempt ID that is not a UUID', () => {
    expect(() =>
      createRequirementResult({ ...INCOMPLETE, allocatedAttemptIds: ['DEMO-A-0001'] }),
    ).toThrow();
  });

  it('rejects an empty sourceRequirementId', () => {
    expect(() => createRequirementResult({ ...INCOMPLETE, sourceRequirementId: '' })).toThrow();
  });

  it('rejects an empty sourceRef', () => {
    expect(() => createRequirementResult({ ...INCOMPLETE, sourceRef: '' })).toThrow();
  });
});

describe('RequirementResultSchema', () => {
  it('accepts a null parent for a top-level requirement', () => {
    const result = RequirementResultSchema.safeParse({
      ...INCOMPLETE,
      parentSourceRequirementId: null,
    });

    expect(result.data?.parentSourceRequirementId).toBeNull();
  });

  it('rejects an omitted parent, because unknown must be an explicit null', () => {
    const { parentSourceRequirementId: omitted, ...withoutParent } = INCOMPLETE;

    expect(omitted).toBe('demo.core');
    expect(RequirementResultSchema.safeParse(withoutParent).success).toBe(false);
  });

  it('rejects an empty parent reference', () => {
    expect(
      RequirementResultSchema.safeParse({ ...INCOMPLETE, parentSourceRequirementId: '' }).success,
    ).toBe(false);
  });

  it('rejects an unknown state', () => {
    expect(RequirementResultSchema.safeParse({ ...INCOMPLETE, state: 'WAIVED' }).success).toBe(
      false,
    );
  });

  it('reports every violated invariant on its own field', () => {
    const result = RequirementResultSchema.safeParse({
      ...COMPLETE,
      remainingCourseCount: 2,
      allocatedAttemptIds: [ATTEMPT_2, ATTEMPT_2],
      candidateCourseIds: [COURSE_1, COURSE_1],
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['state'],
      ['allocatedAttemptIds'],
      ['candidateCourseIds'],
    ]);
  });
});
