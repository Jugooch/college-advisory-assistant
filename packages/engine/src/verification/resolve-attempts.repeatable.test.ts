/**
 * @file Tests for resolving attempt groups whose courses are repeatable for credit.
 */
import { describe, expect, it } from 'vitest';

import type { Course, RepeatableForCredit, RepeatPolicy } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildTermCalendar,
  completedAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
  SYNTHETIC_COURSES,
  SYNTHETIC_REPEATABLE_COURSES,
  syntheticId,
} from '@caa/test-kit';

import { resolveAttempts } from './resolve-attempts';
import type { AttemptResolutionContext } from './select-counting-attempt';

const ENSEMBLE = SYNTHETIC_REPEATABLE_COURSES.ensemble110;
const TOPICS = SYNTHETIC_REPEATABLE_COURSES.topics280;
const STANDALONE_ID = SYNTHETIC_COURSES.math102.id;
const REPEAT_GROUP_ID = syntheticId('equivalencyGroup', 0x500);
const UNCAPPED: RepeatableForCredit = { maxAttempts: null, maxCreditsHundredths: null };

// NOTE: the resolution context is an engine type, so test-kit has no builder for it.
function buildContext(repeatPolicy: RepeatPolicy | null): AttemptResolutionContext {
  return {
    academicPolicy: buildAcademicPolicy({ repeatPolicy }),
    termCalendar: buildTermCalendar([
      { termCode: '2024SP' },
      { termCode: '2024FA' },
      { termCode: '2025SP' },
      { termCode: '2025FA' },
      { termCode: '2026SP' },
    ]),
  };
}

const UNSET = buildContext(null);

/**
 * Builds a catalog with one equivalency group of two courses, plus a third group member whose
 * statement can differ.
 *
 * @param thirdStatement - The third course's statement.
 * @returns The catalog.
 */
function repeatGroupCatalog(thirdStatement: RepeatableForCredit | null): readonly Course[] {
  const member = (seed: number, repeatableForCredit: RepeatableForCredit | null): Course =>
    buildCourse({ equivalencyGroupId: REPEAT_GROUP_ID, repeatableForCredit }, seed);
  return [member(0x501, UNCAPPED), member(0x502, UNCAPPED), member(0x503, thirdStatement)];
}

const MEMBER_A = syntheticId('course', 0x501);
const MEMBER_B = syntheticId('course', 0x502);

describe('resolveAttempts for courses repeatable for credit', () => {
  it('counts the first four of five ensemble attempts without a repeat policy', () => {
    const attempts = ['2024SP', '2024FA', '2025SP', '2025FA', '2026SP'].map((termCode, index) =>
      completedAttempt({ courseId: ENSEMBLE.id, termCode, creditsEarnedHundredths: 100 }, index),
    );
    const [first, second, third, fourth] = attempts;

    expect(resolveAttempts([...attempts].reverse(), [ENSEMBLE], UNSET)).toEqual([
      {
        groupKey: `course:${ENSEMBLE.id}`,
        equivalencyGroupId: null,
        courseIds: [ENSEMBLE.id],
        repeatableForCredit: { maxAttempts: 4, maxCreditsHundredths: 400 },
        counting: {
          state: 'COUNTED',
          attempts: [first, second, third, fourth],
          earnedCreditsHundredths: 400,
        },
        inProgress: [],
        pendingTransfer: [],
        attempts: [...attempts].reverse(),
      },
    ]);
  });

  it('counts attempts of two equivalent courses that share the same statement', () => {
    const first = completedAttempt({ courseId: MEMBER_A, termCode: '2024SP' }, 1);
    const second = completedAttempt({ courseId: MEMBER_B, termCode: '2024FA' }, 2);

    const [group] = resolveAttempts([second, first], repeatGroupCatalog(UNCAPPED), UNSET);

    expect(group?.repeatableForCredit).toEqual(UNCAPPED);
    expect(group?.counting).toEqual({
      state: 'COUNTED',
      attempts: [first, second],
      earnedCreditsHundredths: 600,
    });
  });

  it('is undetermined when an unattempted course of the group states a different value', () => {
    const attempts = [
      completedAttempt({ courseId: MEMBER_A, termCode: '2024SP' }, 1),
      completedAttempt({ courseId: MEMBER_B, termCode: '2024FA' }, 2),
    ];

    const [group] = resolveAttempts(
      attempts,
      repeatGroupCatalog(null),
      buildContext('MOST_RECENT'),
    );

    expect(group?.repeatableForCredit).toBeNull();
    expect(group?.counting).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
      earnedCreditsHundredths: null,
    });
  });

  it('counts the only completed attempt of a group whose statements conflict', () => {
    const completed = completedAttempt({ courseId: MEMBER_A, termCode: '2024SP' }, 1);
    const current = inProgressAttempt({ courseId: MEMBER_B }, 2);

    const [group] = resolveAttempts([completed, current], repeatGroupCatalog(null), UNSET);

    expect(group?.repeatableForCredit).toBeNull();
    expect(group?.counting).toEqual({
      state: 'COUNTED',
      attempt: completed,
      earnedCreditsHundredths: 300,
    });
  });

  it('still counts one attempt of a course with no statement (AC04)', () => {
    const earlier = completedAttempt({ courseId: STANDALONE_ID, termCode: '2024SP' }, 1);
    const later = completedAttempt({ courseId: STANDALONE_ID, termCode: '2024FA' }, 2);

    const [group] = resolveAttempts(
      [earlier, later],
      [SYNTHETIC_COURSES.math102],
      buildContext('MOST_RECENT'),
    );

    expect(group?.repeatableForCredit).toBeNull();
    expect(group?.counting).toEqual({
      state: 'COUNTED',
      attempt: later,
      earnedCreditsHundredths: 300,
    });
  });

  it('earns nothing from in-progress or pending-transfer attempts of a repeatable course', () => {
    const completed = completedAttempt({ courseId: TOPICS.id, termCode: '2024SP' }, 1);
    const current = inProgressAttempt({ courseId: TOPICS.id }, 2);
    const pending = pendingTransferAttempt({ courseId: TOPICS.id }, 3);

    const [group] = resolveAttempts([completed, current, pending], [TOPICS], UNSET);

    expect(group).toMatchObject({
      counting: { state: 'COUNTED', attempts: [completed], earnedCreditsHundredths: 300 },
      inProgress: [current],
      pendingTransfer: [pending],
    });
  });

  it('is undetermined when the catalog is incomplete, even for a repeatable course', () => {
    const attempts = [
      completedAttempt({ courseId: TOPICS.id }, 1),
      completedAttempt({ courseId: syntheticId('course', 0x999) }, 2),
    ];

    const groups = resolveAttempts(attempts, [TOPICS], UNSET);

    expect(groups.map((group) => [group.repeatableForCredit, group.counting])).toEqual([
      [
        null,
        {
          state: 'UNDETERMINED',
          reasonCode: 'COURSE_NOT_IN_CATALOG',
          earnedCreditsHundredths: null,
        },
      ],
      [
        null,
        {
          state: 'UNDETERMINED',
          reasonCode: 'COURSE_NOT_IN_CATALOG',
          earnedCreditsHundredths: null,
        },
      ],
    ]);
  });
});
