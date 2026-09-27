/**
 * @file Tests for grouping attempts by equivalency group and resolving the counting attempt.
 */
import { describe, expect, it } from 'vitest';

import {
  type AttemptStatus,
  type Course,
  type CourseAttempt,
  createAcademicPolicy,
  createCourse,
  createCourseAttempt,
  type RepeatPolicy,
} from '@caa/domain';

import { resolveAttempts } from './resolve-attempts';
import type { AttemptResolutionContext } from './select-counting-attempt';

// NOTE: the engine doesn't depend on @caa/test-kit yet, so these use the domain factories
// directly.
const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const GROUP_ID = '00000000-0000-4000-8000-0000000000e1';
const CALC_ID = '00000000-0000-4000-8000-0000000000c1';
const CALC_HONORS_ID = '00000000-0000-4000-8000-0000000000c2';
const WRITING_ID = '00000000-0000-4000-8000-0000000000c3';
const STUDIO_ID = '00000000-0000-4000-8000-0000000000c4';
const MISSING_ID = '00000000-0000-4000-8000-0000000000c9';

function buildCourse(id: string, equivalencyGroupId: string | null): Course {
  return createCourse({
    id,
    tenantId: TENANT_ID,
    sourceCourseId: `demo-${id.slice(-2)}`,
    label: `DEMO ${id.slice(-2)}`,
    creditsHundredths: 300,
    minCreditsHundredths: null,
    maxCreditsHundredths: null,
    equivalencyGroupId,
  });
}

const STUDIO = createCourse({
  id: STUDIO_ID,
  tenantId: TENANT_ID,
  sourceCourseId: 'demo-c4',
  label: 'DEMO STUDIO',
  creditsHundredths: null,
  minCreditsHundredths: 100,
  maxCreditsHundredths: 400,
  equivalencyGroupId: null,
});

const COURSES = [
  buildCourse(CALC_ID, GROUP_ID),
  buildCourse(CALC_HONORS_ID, GROUP_ID),
  buildCourse(WRITING_ID, null),
  STUDIO,
];

let nextAttempt = 0;

function buildAttempt(courseId: string, status: AttemptStatus, termCode = '2025FA'): CourseAttempt {
  nextAttempt += 1;
  const suffix = String(nextAttempt).padStart(2, '0');
  const isEarning = status === 'COMPLETED' || status === 'TRANSFER_AWARDED';
  const isGraded = isEarning || status === 'WITHDRAWN' || status === 'INCOMPLETE';
  return createCourseAttempt({
    id: `00000000-0000-4000-8000-0000000000${suffix}`,
    tenantId: TENANT_ID,
    studentId: '00000000-0000-4000-8000-000000000002',
    courseId,
    sourceAttemptId: `demo-attempt-${suffix}`,
    termCode,
    status,
    grade: isGraded ? { scheme: 'LETTER', value: 'B' } : null,
    creditsEarnedHundredths: isEarning ? 300 : null,
  });
}

function buildContext(repeatPolicy: RepeatPolicy | null): AttemptResolutionContext {
  return {
    academicPolicy: createAcademicPolicy({
      tenantId: TENANT_ID,
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      lowestPassingLetterGrade: null,
      repeatPolicy,
    }),
    termCodesOldestFirst: ['2025FA', '2026SP'],
  };
}

const UNSET = buildContext(null);
const MOST_RECENT = buildContext('MOST_RECENT');

describe('resolveAttempts', () => {
  it('returns no groups when there are no attempts', () => {
    expect(resolveAttempts([], COURSES, UNSET)).toEqual([]);
  });

  it('counts only one of two aliases in the same equivalency group', () => {
    const calc = buildAttempt(CALC_ID, 'COMPLETED', '2025FA');
    const honors = buildAttempt(CALC_HONORS_ID, 'COMPLETED', '2026SP');

    expect(resolveAttempts([honors, calc], COURSES, MOST_RECENT)).toEqual([
      {
        groupKey: `equivalency:${GROUP_ID}`,
        equivalencyGroupId: GROUP_ID,
        courseIds: [CALC_ID, CALC_HONORS_ID],
        counting: { state: 'COUNTED', attempt: honors, earnedCreditsHundredths: 300 },
        inProgress: [],
        pendingTransfer: [],
        attempts: [honors, calc],
      },
    ]);
  });

  it('leaves a repeated course undetermined when the policy has no repeat policy', () => {
    const attempts = [buildAttempt(WRITING_ID, 'COMPLETED'), buildAttempt(WRITING_ID, 'COMPLETED')];

    const [group] = resolveAttempts(attempts, COURSES, UNSET);

    expect(group?.counting).toEqual({
      state: 'UNDETERMINED',
      reasonCode: 'REPEAT_POLICY_UNDEFINED',
      earnedCreditsHundredths: null,
    });
  });

  it('groups a course without an equivalency group by its course ID', () => {
    const attempt = buildAttempt(WRITING_ID, 'COMPLETED');

    const [group] = resolveAttempts([attempt], COURSES, UNSET);

    expect(group).toMatchObject({
      groupKey: `course:${WRITING_ID}`,
      equivalencyGroupId: null,
      courseIds: [WRITING_ID],
    });
  });

  it('reports in-progress and pending-transfer attempts without counting them', () => {
    const inProgress = buildAttempt(CALC_ID, 'IN_PROGRESS');
    const pending = buildAttempt(CALC_HONORS_ID, 'TRANSFER_PENDING');

    const [group] = resolveAttempts([inProgress, pending], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'NONE', earnedCreditsHundredths: 0 },
      inProgress: [inProgress],
      pendingTransfer: [pending],
    });
  });

  it('keeps withdrawn and incomplete attempts as evidence only', () => {
    const withdrawn = buildAttempt(WRITING_ID, 'WITHDRAWN');
    const incomplete = buildAttempt(WRITING_ID, 'INCOMPLETE');

    const [group] = resolveAttempts([withdrawn, incomplete], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'NONE', earnedCreditsHundredths: 0 },
      inProgress: [],
      pendingTransfer: [],
      attempts: [withdrawn, incomplete],
    });
  });

  it('counts an awarded transfer attempt', () => {
    const awarded = buildAttempt(WRITING_ID, 'TRANSFER_AWARDED');

    const [group] = resolveAttempts([awarded], COURSES, UNSET);

    expect(group?.counting).toEqual({
      state: 'COUNTED',
      attempt: awarded,
      earnedCreditsHundredths: 300,
    });
  });

  it('counts the completed attempt while listing a retake in progress', () => {
    const completed = buildAttempt(WRITING_ID, 'COMPLETED');
    const retake = buildAttempt(WRITING_ID, 'IN_PROGRESS', '2026SP');

    const [group] = resolveAttempts([completed, retake], COURSES, UNSET);

    expect(group).toMatchObject({
      counting: { state: 'COUNTED', attempt: completed, earnedCreditsHundredths: 300 },
      inProgress: [retake],
    });
  });

  it('takes earned credit for a variable-credit course from the attempt, not the course range', () => {
    const attempt = createCourseAttempt({
      id: '00000000-0000-4000-8000-0000000000a1',
      tenantId: TENANT_ID,
      studentId: '00000000-0000-4000-8000-000000000002',
      courseId: STUDIO_ID,
      sourceAttemptId: 'demo-attempt-a1',
      termCode: '2025FA',
      status: 'COMPLETED',
      grade: { scheme: 'LETTER', value: 'A' },
      creditsEarnedHundredths: 150,
    });

    const [group] = resolveAttempts([attempt], COURSES, UNSET);

    expect(group?.counting).toEqual({
      state: 'COUNTED',
      attempt,
      earnedCreditsHundredths: 150,
    });
  });

  it('leaves a group undetermined when its course is missing from the catalog', () => {
    const attempt = buildAttempt(MISSING_ID, 'COMPLETED');

    const [group] = resolveAttempts([attempt], COURSES, UNSET);

    expect(group).toMatchObject({
      groupKey: `course:${MISSING_ID}`,
      equivalencyGroupId: null,
      counting: {
        state: 'UNDETERMINED',
        reasonCode: 'COURSE_NOT_IN_CATALOG',
        earnedCreditsHundredths: null,
      },
    });
  });

  it('returns groups sorted by group key regardless of input order', () => {
    const attempts = [
      buildAttempt(CALC_ID, 'COMPLETED'),
      buildAttempt(STUDIO_ID, 'IN_PROGRESS'),
      buildAttempt(WRITING_ID, 'COMPLETED'),
    ];

    const keys = resolveAttempts(attempts, COURSES, UNSET).map((group) => group.groupKey);

    expect(keys).toEqual([
      `course:${WRITING_ID}`,
      `course:${STUDIO_ID}`,
      `equivalency:${GROUP_ID}`,
    ]);
  });
});
