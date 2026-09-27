/**
 * @file Tests for grouping attempts by equivalency group and resolving the counting attempt.
 */
import { describe, expect, it } from 'vitest';

import type { RepeatPolicy } from '@caa/domain';
import {
  buildAcademicPolicy,
  completedAttempt,
  incompleteAttempt,
  inProgressAttempt,
  letter,
  pendingTransferAttempt,
  SYNTHETIC_COURSES,
  SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID,
  syntheticId,
  transferAwardedAttempt,
  withdrawnAttempt,
} from '@caa/test-kit';

import { resolveAttempts } from './resolve-attempts';
import type { AttemptResolutionContext } from './select-counting-attempt';

const COURSES = Object.values(SYNTHETIC_COURSES);
const GROUP_ID = SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID;
/** DEMO-MATH 101 and 111 share the math equivalency group. */
const CALC_ID = SYNTHETIC_COURSES.math101.id;
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;
/** DEMO-MATH 102 has no equivalency group. */
const STANDALONE_ID = SYNTHETIC_COURSES.math102.id;
/** DEMO-IND 390 is a variable-credit course (1.00 to 3.00 credits). */
const VARIABLE_ID = SYNTHETIC_COURSES.ind390.id;
/** A course ID that no synthetic catalog entry uses. */
const MISSING_ID = syntheticId('course', 0x999);

// NOTE: the resolution context is an engine type, so test-kit has no builder for it.
function buildContext(repeatPolicy: RepeatPolicy | null): AttemptResolutionContext {
  return {
    academicPolicy: buildAcademicPolicy({ repeatPolicy }),
    termCodesOldestFirst: ['2025FA', '2026SP'],
  };
}

const UNSET = buildContext(null);
const MOST_RECENT = buildContext('MOST_RECENT');

const CATALOG_UNDETERMINED = {
  state: 'UNDETERMINED',
  reasonCode: 'COURSE_NOT_IN_CATALOG',
  earnedCreditsHundredths: null,
};

describe('resolveAttempts', () => {
  it('returns no groups when there are no attempts', () => {
    expect(resolveAttempts([], COURSES, UNSET)).toEqual([]);
  });

  it('counts only one of two aliases in the same equivalency group', () => {
    const calc = completedAttempt({ courseId: CALC_ID, termCode: '2025FA' }, 1);
    const alias = completedAttempt({ courseId: CALC_ALIAS_ID, termCode: '2026SP' }, 2);

    expect(resolveAttempts([alias, calc], COURSES, MOST_RECENT)).toEqual([
      {
        groupKey: `equivalency:${GROUP_ID}`,
        equivalencyGroupId: GROUP_ID,
        courseIds: [CALC_ID, CALC_ALIAS_ID],
        counting: { state: 'COUNTED', attempt: alias, earnedCreditsHundredths: 300 },
        inProgress: [],
        pendingTransfer: [],
        attempts: [alias, calc],
      },
    ]);
  });

  it('leaves a repeated course undetermined when the policy has no repeat policy', () => {
    const attempts = [
      completedAttempt({ courseId: STANDALONE_ID }, 1),
      completedAttempt({ courseId: STANDALONE_ID }, 2),
    ];

    const [group] = resolveAttempts(attempts, COURSES, UNSET);

    expect(group?.counting).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
      earnedCreditsHundredths: null,
    });
  });

  it('groups a course without an equivalency group by its course ID', () => {
    const attempt = completedAttempt({ courseId: STANDALONE_ID });

    const [group] = resolveAttempts([attempt], COURSES, UNSET);

    expect(group).toMatchObject({
      groupKey: `course:${STANDALONE_ID}`,
      equivalencyGroupId: null,
      courseIds: [STANDALONE_ID],
    });
  });

  it('reports in-progress and pending-transfer attempts without counting them', () => {
    const inProgress = inProgressAttempt({ courseId: CALC_ID }, 1);
    const pending = pendingTransferAttempt({ courseId: CALC_ALIAS_ID }, 2);

    const [group] = resolveAttempts([inProgress, pending], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'NONE', earnedCreditsHundredths: 0 },
      inProgress: [inProgress],
      pendingTransfer: [pending],
    });
  });

  it('keeps withdrawn and incomplete attempts as evidence only', () => {
    const withdrawn = withdrawnAttempt({ courseId: STANDALONE_ID }, 1);
    const incomplete = incompleteAttempt({ courseId: STANDALONE_ID }, 2);

    const [group] = resolveAttempts([withdrawn, incomplete], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'NONE', earnedCreditsHundredths: 0 },
      inProgress: [],
      pendingTransfer: [],
      attempts: [withdrawn, incomplete],
    });
  });

  it('counts an awarded transfer attempt', () => {
    const awarded = transferAwardedAttempt({ courseId: STANDALONE_ID });

    const [group] = resolveAttempts([awarded], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'COUNTED', attempt: awarded, earnedCreditsHundredths: 300 },
    });
  });

  it('counts the completed attempt while listing a retake in progress', () => {
    const completed = completedAttempt({ courseId: STANDALONE_ID }, 1);
    const retake = inProgressAttempt({ courseId: STANDALONE_ID }, 2);

    const [group] = resolveAttempts([completed, retake], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'COUNTED', attempt: completed, earnedCreditsHundredths: 300 },
      inProgress: [retake],
    });
  });

  it('takes earned credit for a variable-credit course from the attempt, not the course range', () => {
    const attempt = completedAttempt({ courseId: VARIABLE_ID, creditsEarnedHundredths: 150 });

    const [group] = resolveAttempts([attempt], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'COUNTED', attempt, earnedCreditsHundredths: 150 },
    });
  });

  it('leaves every group undetermined when any attempted course is missing from the catalog', () => {
    const calc = completedAttempt({ courseId: CALC_ID, termCode: '2025FA' }, 1);
    const alias = completedAttempt(
      { courseId: MISSING_ID, termCode: '2026SP', grade: letter('D') },
      2,
    );
    const standalone = completedAttempt({ courseId: STANDALONE_ID }, 3);

    const groups = resolveAttempts([calc, alias, standalone], COURSES, MOST_RECENT);

    expect(groups.map((group) => [group.groupKey, group.counting, group.attempts])).toEqual([
      [`course:${STANDALONE_ID}`, CATALOG_UNDETERMINED, [standalone]],
      [`course:${MISSING_ID}`, CATALOG_UNDETERMINED, [alias]],
      [`equivalency:${GROUP_ID}`, CATALOG_UNDETERMINED, [calc]],
    ]);
  });

  it('returns groups sorted by group key regardless of input order', () => {
    const attempts = [
      completedAttempt({ courseId: CALC_ID }, 1),
      inProgressAttempt({ courseId: VARIABLE_ID }, 2),
      completedAttempt({ courseId: STANDALONE_ID }, 3),
    ];

    const keys = resolveAttempts(attempts, COURSES, UNSET).map((group) => group.groupKey);

    expect(keys).toEqual([
      `course:${STANDALONE_ID}`,
      `course:${VARIABLE_ID}`,
      `equivalency:${GROUP_ID}`,
    ]);
  });
});
