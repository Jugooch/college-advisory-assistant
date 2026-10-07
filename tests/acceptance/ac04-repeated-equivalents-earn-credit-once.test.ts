/**
 * @file Acceptance: a repeated course, or two courses sharing an equivalency group, never earns
 *   duplicate credit unless policy explicitly permits it.
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, CountingState, ReasonCode, RepeatPolicy } from '@caa/domain';
import {
  CandidateSetInputError,
  checkCreditLoad,
  evaluatePrerequisite,
  resolveAttempts,
} from '@caa/engine';
import {
  buildAcademicPolicy,
  buildCourse,
  buildPrerequisiteRule,
  completedAttempt,
  COUNTING_TERM_CALENDAR,
  course,
  GOLDEN_CATALOG,
  GOLDEN_TERM_CALENDAR,
  letter,
  loadPolicy,
  planned,
  SYNTHETIC_COURSES,
  SYNTHETIC_REPEATABLE_COURSES,
  syntheticId,
} from '@caa/test-kit';

import { acceptanceIt } from '../support/known-findings';

const MATH101_THEN_MATH111 = [
  completedAttempt({ termCode: '2025FA' }, 1),
  completedAttempt({ courseId: SYNTHETIC_COURSES.math111.id, termCode: '2026SP' }, 2),
];

/** The counting resolution of one attempt group. */
type AttemptCounting = ReturnType<typeof resolveAttempts>[number]['counting'];

/**
 * Resolves a one-group set of attempts with the golden calendar and the given repeat policy.
 *
 * @param courses - The catalog.
 * @param attempts - The attempts.
 * @param repeatPolicy - The institution's repeat policy, `null` for none.
 * @returns The one group's counting resolution.
 */
function countingOf(
  courses: Parameters<typeof resolveAttempts>[1],
  attempts: Parameters<typeof resolveAttempts>[0],
  repeatPolicy: RepeatPolicy | null = null,
): AttemptCounting {
  const groups = resolveAttempts(attempts, courses, {
    academicPolicy: buildAcademicPolicy({ repeatPolicy }),
    termCalendar: COUNTING_TERM_CALENDAR,
  });
  const [group] = groups;
  expect(groups).toHaveLength(1);
  if (group === undefined) {
    throw new Error('no attempt group');
  }
  return group.counting;
}

describe('AC04 equivalents and repeats earn credit once', () => {
  it('resolves two equivalents to one group with 3.00 credits, not 6.00', () => {
    const groups = resolveAttempts(MATH101_THEN_MATH111, GOLDEN_CATALOG, {
      academicPolicy: buildAcademicPolicy({ repeatPolicy: RepeatPolicy.MostRecent }),
      termCalendar: GOLDEN_TERM_CALENDAR,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.counting).toMatchObject({
      state: CountingState.Counted,
      attempt: { id: syntheticId('attempt', 2) },
      earnedCreditsHundredths: 300,
    });
  });

  it('leaves earned credit unknown, never 6.00, when no repeat policy says which attempt counts', () => {
    const groups = resolveAttempts(MATH101_THEN_MATH111, GOLDEN_CATALOG, {
      academicPolicy: buildAcademicPolicy({ repeatPolicy: null }),
      termCalendar: GOLDEN_TERM_CALENDAR,
    });

    expect(groups[0]?.counting).toMatchObject({
      state: CountingState.Undetermined,
      earnedCreditsHundredths: null,
    });
  });

  it('refuses to load two equivalents into one candidate set instead of counting both', () => {
    const selections = [planned(SYNTHETIC_COURSES.math101), planned(SYNTHETIC_COURSES.math111)];

    expect(() => checkCreditLoad(selections, loadPolicy(0, 1800))).toThrow(CandidateSetInputError);
  });
});

const { ensemble110: ensemble, topics280: topics } = SYNTHETIC_REPEATABLE_COURSES;
const FIVE_TERMS = ['2025FA', '2026SP', '2026FA', '2027SP', '2027FA'] as const;

describe('AC04 courses repeatable for credit count each attempt within their caps', () => {
  acceptanceIt('AC04', 'counts the first four of five ensemble attempts: 4.00, not 5.00', () => {
    const attempts = FIVE_TERMS.map((termCode, index) =>
      completedAttempt(
        { courseId: ensemble.id, termCode, creditsEarnedHundredths: 100 },
        index + 1,
      ),
    );

    expect(countingOf([ensemble], attempts).earnedCreditsHundredths).toBe(400);
  });

  acceptanceIt('AC04', 'counts both attempts of an uncapped topics course: 6.00', () => {
    const attempts = [
      completedAttempt({ courseId: topics.id, termCode: '2025FA' }, 1),
      completedAttempt({ courseId: topics.id, termCode: '2026SP' }, 2),
    ];

    expect(countingOf([topics], attempts).earnedCreditsHundredths).toBe(600);
  });

  acceptanceIt('AC04', 'caps two 3.00 attempts at a 4.00 credit cap', () => {
    const capped = buildCourse({
      repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: 400 },
    });
    const attempts = [
      completedAttempt({ courseId: capped.id, termCode: '2025FA' }, 1),
      completedAttempt({ courseId: capped.id, termCode: '2026SP' }, 2),
    ];

    expect(countingOf([capped], attempts).earnedCreditsHundredths).toBe(400);
  });

  acceptanceIt('AC04', 'does not spend an attempt on a failed attempt that earned nothing', () => {
    const capped = buildCourse({
      repeatableForCredit: { maxAttempts: 2, maxCreditsHundredths: null },
    });
    const attempts = [
      completedAttempt({ courseId: capped.id, termCode: '2025FA' }, 1),
      completedAttempt(
        {
          courseId: capped.id,
          termCode: '2026SP',
          grade: letter('F'),
          creditsEarnedHundredths: 0,
        },
        2,
      ),
      completedAttempt({ courseId: capped.id, termCode: '2026FA' }, 3),
      completedAttempt({ courseId: capped.id, termCode: '2027SP' }, 4),
    ];

    expect(countingOf([capped], attempts).earnedCreditsHundredths).toBe(600);
  });

  it('keeps one counting attempt, 3.00, for a course that is not repeatable for credit', () => {
    const plain = buildCourse();
    const attempts = [
      completedAttempt({ courseId: plain.id, termCode: '2025FA' }, 1),
      completedAttempt({ courseId: plain.id, termCode: '2026SP' }, 2),
    ];

    expect(countingOf([plain], attempts, RepeatPolicy.MostRecent)).toMatchObject({
      state: CountingState.Counted,
      earnedCreditsHundredths: 300,
    });
  });

  acceptanceIt(
    'AC04',
    'leaves equivalents with different repeat caps undetermined, never counted',
    () => {
      const groupId = syntheticId('equivalencyGroup', 7);
      const first = buildCourse(
        {
          equivalencyGroupId: groupId,
          repeatableForCredit: { maxAttempts: 4, maxCreditsHundredths: 400 },
        },
        1,
      );
      const second = buildCourse(
        {
          equivalencyGroupId: groupId,
          repeatableForCredit: { maxAttempts: 2, maxCreditsHundredths: 600 },
        },
        2,
      );
      const attempts = [
        completedAttempt({ courseId: first.id, termCode: '2025FA' }, 1),
        completedAttempt({ courseId: second.id, termCode: '2026SP' }, 2),
      ];

      expect(countingOf([first, second], attempts, RepeatPolicy.MostRecent)).toEqual({
        state: CountingState.Undetermined,
        reasonCode: ReasonCode.RepeatPolicyUndefined,
        earnedCreditsHundredths: null,
      });
    },
  );

  acceptanceIt(
    'AC04',
    'leaves the total undetermined when a cap binds between same-term attempts of different credit',
    () => {
      const capped = buildCourse({
        repeatableForCredit: { maxAttempts: 2, maxCreditsHundredths: null },
      });
      const attempts = [
        completedAttempt(
          { courseId: capped.id, termCode: '2025FA', creditsEarnedHundredths: 100 },
          1,
        ),
        completedAttempt(
          { courseId: capped.id, termCode: '2026SP', creditsEarnedHundredths: 100 },
          2,
        ),
        completedAttempt(
          { courseId: capped.id, termCode: '2026SP', creditsEarnedHundredths: 200 },
          3,
        ),
      ];

      expect(countingOf([capped], attempts)).toEqual({
        state: CountingState.Undetermined,
        reasonCode: ReasonCode.RepeatOrderUndetermined,
        earnedCreditsHundredths: null,
      });
    },
  );

  acceptanceIt(
    'AC04',
    'leaves the total unknown, never summed, when a counted attempt has unknown credit',
    () => {
      const attempts = [
        completedAttempt(
          { courseId: ensemble.id, termCode: '2025FA', creditsEarnedHundredths: 100 },
          1,
        ),
        completedAttempt(
          { courseId: ensemble.id, termCode: '2026SP', creditsEarnedHundredths: null },
          2,
        ),
      ];

      expect(countingOf([ensemble], attempts).earnedCreditsHundredths).toBeNull();
    },
  );

  acceptanceIt(
    'AC04',
    'passes a repeatable prerequisite leaf on one attempt meeting the minimum, with no repeat policy',
    () => {
      const attempts = [
        completedAttempt({ courseId: ensemble.id, grade: letter('D'), termCode: '2025FA' }, 1),
        completedAttempt({ courseId: ensemble.id, grade: letter('B'), termCode: '2026SP' }, 2),
      ];
      const rule = buildPrerequisiteRule({ expression: course(ensemble.id, letter('C')) });

      const check = evaluatePrerequisite(
        rule,
        { attempts, courses: [...GOLDEN_CATALOG, ensemble] },
        {
          academicPolicy: buildAcademicPolicy({ repeatPolicy: null }),
          termCalendar: GOLDEN_TERM_CALENDAR,
        },
      );

      expect(check.state).toBe(CheckState.Pass);
    },
  );
});
