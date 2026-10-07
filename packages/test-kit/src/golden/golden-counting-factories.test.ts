/**
 * @file Tests for the attempt-counting golden case factories: the documented defaults and the
 *   expectation shapes.
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 */
import { describe, expect, it } from 'vitest';

import { CountingState, ReasonCode } from '@caa/domain';

import { buildCourse } from '../builders/course.builder';
import { completedAttempt } from '../builders/course-attempt.builder';
import {
  counted,
  COUNTING_TERM_CALENDAR,
  countingInputs,
  NO_COUNTING_ATTEMPT,
  undetermined,
} from './golden-counting-factories';

describe('countingInputs', () => {
  it('defaults to the counting calendar and states no repeat policy', () => {
    const course = buildCourse();
    const inputs = countingInputs({
      courses: [course],
      attempts: [completedAttempt({ courseId: course.id })],
    });
    expect(inputs.termCalendar).toBe(COUNTING_TERM_CALENDAR);
    expect(inputs.academicPolicy.repeatPolicy).toBeNull();
  });
});

describe('expectation shorthands', () => {
  it('states a COUNTED group with its earned credit and no reason', () => {
    expect(counted(300)).toEqual({
      state: CountingState.Counted,
      reasonCode: null,
      earnedCreditsHundredths: 300,
    });
  });

  it('states an UNDETERMINED group with its reason and null credit', () => {
    expect(undetermined(ReasonCode.RepeatPolicyUndefined)).toEqual({
      state: CountingState.Undetermined,
      reasonCode: ReasonCode.RepeatPolicyUndefined,
      earnedCreditsHundredths: null,
    });
  });

  it('states a NONE group earning 0', () => {
    expect(NO_COUNTING_ATTEMPT.earnedCreditsHundredths).toBe(0);
  });
});
