/**
 * @file Tests for the course attempt data object.
 */
import { describe, expect, it } from 'vitest';

import { AttemptStatus } from '../enums/attempt-status.enum';
import { GradeScheme } from '../enums/grade-scheme.enum';
import {
  type CourseAttemptInput,
  CourseAttemptSchema,
  createCourseAttempt,
} from './course-attempt.model';

const COMPLETED: CourseAttemptInput = {
  id: '5e6f7081-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  courseId: '3c4d5e6f-0000-4000-8000-000000000001',
  sourceAttemptId: 'DEMO-A-0001',
  termCode: '2026SP',
  status: AttemptStatus.Completed,
  grade: { scheme: GradeScheme.Letter, value: 'B+' },
  creditsEarnedHundredths: 350,
};

const IN_PROGRESS: CourseAttemptInput = {
  ...COMPLETED,
  termCode: '2026FA',
  status: AttemptStatus.InProgress,
  grade: null,
  creditsEarnedHundredths: null,
};

describe('createCourseAttempt', () => {
  it('accepts a completed, graded attempt with earned credits', () => {
    expect(createCourseAttempt(COMPLETED)).toEqual({
      id: '5e6f7081-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      courseId: '3c4d5e6f-0000-4000-8000-000000000001',
      sourceAttemptId: 'DEMO-A-0001',
      termCode: '2026SP',
      status: 'COMPLETED',
      grade: { scheme: 'LETTER', value: 'B+' },
      creditsEarnedHundredths: 350,
    });
  });

  it('accepts a completed attempt whose grade and credits the source did not supply', () => {
    const attempt = createCourseAttempt({
      ...COMPLETED,
      grade: null,
      creditsEarnedHundredths: null,
    });

    expect(attempt.grade).toBeNull();
    expect(attempt.creditsEarnedHundredths).toBeNull();
  });

  it('accepts an in-progress attempt with no grade and no credits', () => {
    expect(createCourseAttempt(IN_PROGRESS).status).toBe('IN_PROGRESS');
  });

  it('accepts an awarded transfer with a pass grade and earned credits', () => {
    const attempt = createCourseAttempt({
      ...COMPLETED,
      status: AttemptStatus.TransferAwarded,
      grade: { scheme: GradeScheme.PassFail, value: 'P' },
      creditsEarnedHundredths: 300,
    });

    expect(attempt.creditsEarnedHundredths).toBe(300);
  });

  it('accepts a pending transfer with no grade and no credits', () => {
    expect(
      createCourseAttempt({ ...IN_PROGRESS, status: AttemptStatus.TransferPending }).status,
    ).toBe('TRANSFER_PENDING');
  });

  it('accepts a withdrawn attempt that keeps a source grade but earns no credits', () => {
    const attempt = createCourseAttempt({
      ...COMPLETED,
      status: AttemptStatus.Withdrawn,
      grade: { scheme: GradeScheme.Unknown, value: 'W' },
      creditsEarnedHundredths: null,
    });

    expect(attempt.grade).toEqual({ scheme: 'UNKNOWN', value: 'W' });
  });

  it('rejects an in-progress attempt with a grade', () => {
    expect(() =>
      createCourseAttempt({ ...IN_PROGRESS, grade: { scheme: GradeScheme.Letter, value: 'A' } }),
    ).toThrow(/must not have a grade/);
  });

  it('rejects a pending transfer with a grade', () => {
    expect(() =>
      createCourseAttempt({
        ...IN_PROGRESS,
        status: AttemptStatus.TransferPending,
        grade: { scheme: GradeScheme.PassFail, value: 'P' },
      }),
    ).toThrow(/must not have a grade/);
  });

  it('rejects earned credits on an in-progress attempt', () => {
    expect(() => createCourseAttempt({ ...IN_PROGRESS, creditsEarnedHundredths: 350 })).toThrow(
      /Only COMPLETED and TRANSFER_AWARDED/,
    );
  });

  it('rejects earned credits on a pending transfer', () => {
    expect(() =>
      createCourseAttempt({
        ...IN_PROGRESS,
        status: AttemptStatus.TransferPending,
        creditsEarnedHundredths: 300,
      }),
    ).toThrow(/Only COMPLETED and TRANSFER_AWARDED/);
  });

  it('rejects earned credits on a withdrawn attempt', () => {
    expect(() =>
      createCourseAttempt({ ...COMPLETED, status: AttemptStatus.Withdrawn, grade: null }),
    ).toThrow(/Only COMPLETED and TRANSFER_AWARDED/);
  });

  it('rejects earned credits on an incomplete attempt', () => {
    expect(() =>
      createCourseAttempt({ ...COMPLETED, status: AttemptStatus.Incomplete, grade: null }),
    ).toThrow(/Only COMPLETED and TRANSFER_AWARDED/);
  });

  it('rejects earned credits of zero on a withdrawn attempt, because zero is not unknown', () => {
    expect(() =>
      createCourseAttempt({
        ...COMPLETED,
        status: AttemptStatus.Withdrawn,
        grade: null,
        creditsEarnedHundredths: 0,
      }),
    ).toThrow(/Only COMPLETED and TRANSFER_AWARDED/);
  });

  it('rejects fractional earned credits, because credits are scaled integers', () => {
    expect(() => createCourseAttempt({ ...COMPLETED, creditsEarnedHundredths: 3.5 })).toThrow();
  });

  it('rejects negative earned credits', () => {
    expect(() => createCourseAttempt({ ...COMPLETED, creditsEarnedHundredths: -350 })).toThrow();
  });

  it('rejects an empty sourceAttemptId', () => {
    expect(() => createCourseAttempt({ ...COMPLETED, sourceAttemptId: '' })).toThrow();
  });

  it('rejects an empty termCode', () => {
    expect(() => createCourseAttempt({ ...COMPLETED, termCode: '' })).toThrow();
  });

  it('rejects a courseId that is not a UUID', () => {
    expect(() => createCourseAttempt({ ...COMPLETED, courseId: 'MATH 101' })).toThrow();
  });
});

describe('CourseAttemptSchema', () => {
  it('rejects an unknown status', () => {
    expect(CourseAttemptSchema.safeParse({ ...COMPLETED, status: 'AUDITED' }).success).toBe(false);
  });

  it('rejects a grade that is invalid for its scheme', () => {
    const result = CourseAttemptSchema.safeParse({
      ...COMPLETED,
      grade: { scheme: 'PASS_FAIL', value: 'A' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an omitted grade, because unknown must be an explicit null', () => {
    const result = CourseAttemptSchema.safeParse({
      id: '5e6f7081-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      courseId: '3c4d5e6f-0000-4000-8000-000000000001',
      sourceAttemptId: 'DEMO-A-0001',
      termCode: '2026SP',
      status: 'COMPLETED',
      creditsEarnedHundredths: 350,
    });

    expect(result.success).toBe(false);
  });

  it('reports both invariant violations on their own fields', () => {
    const result = CourseAttemptSchema.safeParse({
      ...IN_PROGRESS,
      grade: { scheme: 'LETTER', value: 'A' },
      creditsEarnedHundredths: 350,
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['grade'],
      ['creditsEarnedHundredths'],
    ]);
  });
});
