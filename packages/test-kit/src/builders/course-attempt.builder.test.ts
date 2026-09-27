/**
 * @file Tests for the synthetic course attempt builder and its status helpers.
 */
import { describe, expect, it } from 'vitest';

import { AttemptStatus, CourseAttemptSchema } from '@caa/domain';

import {
  buildCourseAttempt,
  completedAttempt,
  incompleteAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
  transferAwardedAttempt,
  withdrawnAttempt,
} from './course-attempt.builder';
import { letter } from './grade.builder';

describe('buildCourseAttempt', () => {
  it('defaults to student 1 completing DEMO-MATH 101 with a B in 2026SP', () => {
    expect(buildCourseAttempt()).toEqual({
      id: '60000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      courseId: '50000000-0000-4000-8000-000000000101',
      sourceAttemptId: 'SYN-ATT-000001',
      termCode: '2026SP',
      status: 'COMPLETED',
      grade: { scheme: 'LETTER', value: 'B' },
      creditsEarnedHundredths: 300,
    });
  });

  it('returns deep-equal attempts for the same arguments', () => {
    expect(buildCourseAttempt({ termCode: '2025FA' }, 3)).toEqual(
      buildCourseAttempt({ termCode: '2025FA' }, 3),
    );
  });

  it('derives the id and sourceAttemptId from the seed', () => {
    const attempt = buildCourseAttempt({}, 20);

    expect(attempt.id).toBe('60000000-0000-4000-8000-000000000014');
    expect(attempt.sourceAttemptId).toBe('SYN-ATT-000020');
  });

  it('applies overrides', () => {
    const attempt = buildCourseAttempt({
      courseId: '50000000-0000-4000-8000-000000000102',
      grade: letter('D'),
    });

    expect(attempt.courseId).toBe('50000000-0000-4000-8000-000000000102');
    expect(attempt.grade).toEqual({ scheme: 'LETTER', value: 'D' });
  });

  it('returns an attempt that passes the domain schema', () => {
    expect(CourseAttemptSchema.safeParse(buildCourseAttempt()).success).toBe(true);
  });

  it('rejects a graded in-progress attempt', () => {
    expect(() =>
      buildCourseAttempt({ status: AttemptStatus.InProgress, creditsEarnedHundredths: null }),
    ).toThrow();
  });
});

describe('attempt status helpers', () => {
  it('builds each status with the grade and credits that status allows', () => {
    const summary = [
      completedAttempt(),
      inProgressAttempt(),
      withdrawnAttempt(),
      incompleteAttempt(),
      pendingTransferAttempt(),
      transferAwardedAttempt(),
    ].map(({ status, grade, creditsEarnedHundredths, termCode }) => ({
      status,
      grade,
      creditsEarnedHundredths,
      termCode,
    }));

    expect(summary).toEqual([
      {
        status: 'COMPLETED',
        grade: { scheme: 'LETTER', value: 'B' },
        creditsEarnedHundredths: 300,
        termCode: '2026SP',
      },
      { status: 'IN_PROGRESS', grade: null, creditsEarnedHundredths: null, termCode: '2026FA' },
      { status: 'WITHDRAWN', grade: null, creditsEarnedHundredths: null, termCode: '2026SP' },
      { status: 'INCOMPLETE', grade: null, creditsEarnedHundredths: null, termCode: '2026SP' },
      {
        status: 'TRANSFER_PENDING',
        grade: null,
        creditsEarnedHundredths: null,
        termCode: '2026SP',
      },
      { status: 'TRANSFER_AWARDED', grade: null, creditsEarnedHundredths: 300, termCode: '2026SP' },
    ]);
  });

  it('returns deep-equal attempts for the same arguments', () => {
    expect(inProgressAttempt({}, 4)).toEqual(inProgressAttempt({}, 4));
    expect(pendingTransferAttempt({}, 4)).toEqual(pendingTransferAttempt({}, 4));
  });

  it('applies overrides and the seed', () => {
    const attempt = completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 2);

    expect(attempt.id).toBe('60000000-0000-4000-8000-000000000002');
    expect(attempt.grade).toEqual({ scheme: 'LETTER', value: 'D' });
    expect(attempt.termCode).toBe('2025FA');
  });

  it('rejects a grade on a pending transfer', () => {
    expect(() => pendingTransferAttempt({ grade: letter('A') })).toThrow();
  });
});
