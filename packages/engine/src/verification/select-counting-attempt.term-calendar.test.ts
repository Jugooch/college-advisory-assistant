/**
 * @file Tests that MOST_RECENT orders repeated attempts by the tenant's term calendar sequence.
 */
import { describe, expect, it } from 'vitest';

import type { TermCalendar } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  buildTermCalendar,
  completedAttempt,
  course,
  inProgressAttempt,
  letter,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { evaluatePrerequisite } from './evaluate-prerequisite';
import { selectCountingAttempt } from './select-counting-attempt';

/** `2026SU` sorts after `2026FA` as a string, but this calendar puts it first. */
const CALENDAR: TermCalendar = buildTermCalendar([
  { termCode: '2026SP', sequence: -20 },
  { termCode: '2026SU', sequence: -10 },
  { termCode: '2026FA', sequence: 5 },
]);
const MOST_RECENT = buildAcademicPolicy({
  repeatPolicy: 'MOST_RECENT',
  allowsInProgressPrerequisites: true,
});

describe('selectCountingAttempt under MOST_RECENT with a term calendar', () => {
  it('counts the attempt with the larger sequence, not the later-sorting code', () => {
    const fall = completedAttempt({ termCode: '2026FA' }, 1);
    const summer = completedAttempt({ termCode: '2026SU' }, 2);

    const resolution = selectCountingAttempt([summer, fall], {
      academicPolicy: MOST_RECENT,
      termCalendar: CALENDAR,
    });

    expect(resolution).toMatchObject({ state: 'COUNTED', attempt: fall });
  });

  it('counts the later of two attempts whose sequences are both negative', () => {
    const spring = completedAttempt({ termCode: '2026SP' }, 1);
    const summer = completedAttempt({ termCode: '2026SU' }, 2);

    const resolution = selectCountingAttempt([spring, summer], {
      academicPolicy: MOST_RECENT,
      termCalendar: CALENDAR,
    });

    expect(resolution).toMatchObject({ state: 'COUNTED', attempt: summer });
  });

  it('is UNDETERMINED REPEAT_ORDER_UNDETERMINED when a term is not in the calendar', () => {
    const attempts = [
      completedAttempt({ termCode: '2026FA' }, 1),
      completedAttempt({ termCode: '2027SP' }, 2),
    ];

    expect(
      selectCountingAttempt(attempts, { academicPolicy: MOST_RECENT, termCalendar: CALENDAR }),
    ).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_ORDER_UNDETERMINED',
      earnedCreditsHundredths: null,
    });
  });

  it("is UNDETERMINED when the calendar is another tenant's", () => {
    const policy = buildAcademicPolicy({
      repeatPolicy: 'MOST_RECENT',
      tenantId: SYNTHETIC_TENANTS.b.id,
    });
    const attempts = [
      completedAttempt({ termCode: '2026SP' }, 1),
      completedAttempt({ termCode: '2026FA' }, 2),
    ];

    expect(
      selectCountingAttempt(attempts, { academicPolicy: policy, termCalendar: CALENDAR }),
    ).toMatchObject({ state: 'UNDETERMINED', reasonCode: 'REPEAT_ORDER_UNDETERMINED' });
  });
});

describe('evaluatePrerequisite with a retake under MOST_RECENT and a term calendar', () => {
  const rule = buildPrerequisiteRule({
    expression: course(SYNTHETIC_COURSES.math101.id, letter('C')),
  });
  const courses = Object.values(SYNTHETIC_COURSES);
  const belowMinimum = completedAttempt({ termCode: '2026SU', grade: letter('D') }, 1);

  it('is CONDITIONAL when the calendar puts the retake term later', () => {
    const retake = inProgressAttempt({ termCode: '2026FA' }, 2);

    const check = evaluatePrerequisite(
      rule,
      { attempts: [belowMinimum, retake], courses },
      { academicPolicy: MOST_RECENT, termCalendar: CALENDAR },
    );

    expect([check.state, check.reasonCode]).toEqual(['CONDITIONAL', 'IN_PROGRESS_MIN_GRADE']);
  });

  it('is UNKNOWN REPEAT_ORDER_UNDETERMINED when the calendar puts the retake term earlier', () => {
    const retake = inProgressAttempt({ termCode: '2026SP' }, 2);

    const check = evaluatePrerequisite(
      rule,
      { attempts: [belowMinimum, retake], courses },
      { academicPolicy: MOST_RECENT, termCalendar: CALENDAR },
    );

    expect([check.state, check.reasonCode]).toEqual(['UNKNOWN', 'REPEAT_ORDER_UNDETERMINED']);
  });

  it('is UNKNOWN REPEAT_ORDER_UNDETERMINED when the retake term is not in the calendar', () => {
    const retake = inProgressAttempt({ termCode: '2027SP' }, 2);

    const check = evaluatePrerequisite(
      rule,
      { attempts: [belowMinimum, retake], courses },
      { academicPolicy: MOST_RECENT, termCalendar: CALENDAR },
    );

    expect([check.state, check.reasonCode]).toEqual(['UNKNOWN', 'REPEAT_ORDER_UNDETERMINED']);
  });
});
