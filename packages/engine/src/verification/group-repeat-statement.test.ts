/**
 * @file Tests for finding the repeat-for-credit statement an attempt group's courses share.
 */
import { describe, expect, it } from 'vitest';

import { buildCourse } from '@caa/test-kit';

import { groupRepeatStatement } from './group-repeat-statement';

const CAPPED = { maxAttempts: 4, maxCreditsHundredths: 400 };

describe('groupRepeatStatement', () => {
  it('has no statement for a group without catalog courses', () => {
    expect(groupRepeatStatement([])).toEqual({ isConflict: false, statement: null });
  });

  it('has no statement when every course states none', () => {
    const courses = [buildCourse({}, 1), buildCourse({}, 2)];

    expect(groupRepeatStatement(courses)).toEqual({ isConflict: false, statement: null });
  });

  it('returns the statement every course shares', () => {
    const courses = [
      buildCourse({ repeatableForCredit: { ...CAPPED } }, 1),
      buildCourse({ repeatableForCredit: { ...CAPPED } }, 2),
    ];

    expect(groupRepeatStatement(courses)).toEqual({ isConflict: false, statement: CAPPED });
  });

  it('conflicts when one course states a statement and another states none', () => {
    const courses = [buildCourse({ repeatableForCredit: CAPPED }, 1), buildCourse({}, 2)];

    expect(groupRepeatStatement(courses)).toEqual({ isConflict: true });
  });

  it('conflicts when the courses state different caps', () => {
    const courses = [
      buildCourse({ repeatableForCredit: CAPPED }, 1),
      buildCourse({ repeatableForCredit: { maxAttempts: 4, maxCreditsHundredths: null } }, 2),
    ];

    expect(groupRepeatStatement(courses)).toEqual({ isConflict: true });
  });

  it('conflicts when the courses state different attempt caps', () => {
    const courses = [
      buildCourse({ repeatableForCredit: CAPPED }, 1),
      buildCourse({ repeatableForCredit: { maxAttempts: 3, maxCreditsHundredths: 400 } }, 2),
    ];

    expect(groupRepeatStatement(courses)).toEqual({ isConflict: true });
  });
});
