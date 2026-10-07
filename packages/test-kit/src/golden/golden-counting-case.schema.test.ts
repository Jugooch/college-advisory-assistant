/**
 * @file Schema and corpus tests for the attempt-counting golden case kind.
 * @requirement FR-06
 */
import { describe, expect, it } from 'vitest';

import { CountingState, ReasonCode } from '@caa/domain';

import { buildCourse } from '../builders/course.builder';
import { completedAttempt } from '../builders/course-attempt.builder';
import { GOLDEN_DEVELOPMENT_COUNTING_CORPUS } from './golden-corpus';
import {
  counted,
  countingCase,
  countingInputs,
  ExpectedCountingSchema,
  NO_COUNTING_ATTEMPT,
  undetermined,
} from './golden-counting-case.schema';

const COURSE = buildCourse();
const INPUTS = countingInputs({
  courses: [COURSE],
  attempts: [completedAttempt({ courseId: COURSE.id })],
});
const BASE = {
  id: 'GC-RCR-901',
  title: 'Schema test case',
  requirementIds: ['FR-06'],
  inputs: INPUTS,
  expected: counted(300),
  prohibitedClaims: [{ earnedCreditsHundredths: 600, claim: 'must not earn 6.00' }],
  rationale: 'One attempt of 3.00.',
  citations: ['docs/adr/0012 §2'],
};

describe('countingCase', () => {
  it('builds a REPEAT-family case with the pending review defaults', () => {
    const golden = countingCase(BASE);

    expect(golden).toMatchObject({
      family: 'REPEAT',
      reviewer: 'pending-academic-review',
      adjudicatedOn: '2026-10-06',
      allowedAlternatives: [],
    });
  });

  it('rejects an expected result that makes a prohibited claim', () => {
    expect(() =>
      countingCase({
        ...BASE,
        prohibitedClaims: [{ earnedCreditsHundredths: 300, claim: 'x' }],
      }),
    ).toThrow(/prohibited claim/);
  });

  it('rejects an attempt of a course the catalog lacks', () => {
    const other = buildCourse({}, 2);

    expect(() => countingCase({ ...BASE, inputs: { ...INPUTS, courses: [other] } })).toThrow(
      /attempted course/,
    );
  });

  it('rejects a prohibited claim that names both a state and a credit', () => {
    expect(() =>
      countingCase({
        ...BASE,
        prohibitedClaims: [{ state: CountingState.None, earnedCreditsHundredths: 1, claim: 'x' }],
      }),
    ).toThrow(/not both/);
  });
});

describe('ExpectedCountingSchema', () => {
  it('requires a reason code exactly when UNDETERMINED', () => {
    expect(ExpectedCountingSchema.safeParse(counted(100)).success).toBe(true);
    expect(
      ExpectedCountingSchema.safeParse({
        ...counted(100),
        reasonCode: ReasonCode.RepeatPolicyUndefined,
      }).success,
    ).toBe(false);
    expect(
      ExpectedCountingSchema.safeParse({
        ...undetermined(ReasonCode.RepeatOrderUndetermined),
        reasonCode: null,
      }).success,
    ).toBe(false);
  });

  it('requires UNDETERMINED to earn null and NONE to earn 0', () => {
    expect(
      ExpectedCountingSchema.safeParse({
        ...undetermined(ReasonCode.RepeatPolicyUndefined),
        earnedCreditsHundredths: 0,
      }).success,
    ).toBe(false);
    expect(
      ExpectedCountingSchema.safeParse({ ...NO_COUNTING_ATTEMPT, earnedCreditsHundredths: null })
        .success,
    ).toBe(false);
  });
});

describe('GOLDEN_DEVELOPMENT_COUNTING_CORPUS', () => {
  it('has unique GC-RCR IDs numbered 001 to 020', () => {
    expect(GOLDEN_DEVELOPMENT_COUNTING_CORPUS.map((golden) => golden.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `GC-RCR-${String(index + 1).padStart(3, '0')}`),
    );
  });
});
