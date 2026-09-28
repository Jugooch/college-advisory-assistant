/**
 * @file Tests for the course attempt row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AttemptStatus, GradeScheme } from '@caa/domain';

import type { CourseAttemptRow } from '../tables/course-attempt.table';
import { toCourseAttempt } from './course-attempt.mapper';

const ROW: CourseAttemptRow = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  courseId: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
  sourceAttemptId: 'SYN-ATT-0001',
  termCode: '2026SP',
  status: AttemptStatus.Completed,
  gradeScheme: GradeScheme.Letter,
  gradeValue: 'B+',
  creditsEarnedHundredths: 300,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toCourseAttempt', () => {
  it('rebuilds the grade from its scheme and value', () => {
    const attempt = toCourseAttempt(ROW);

    expect(attempt).toEqual({
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
      courseId: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
      sourceAttemptId: 'SYN-ATT-0001',
      termCode: '2026SP',
      status: 'COMPLETED',
      grade: { scheme: 'LETTER', value: 'B+' },
      creditsEarnedHundredths: 300,
    });
  });

  it('keeps an ungraded attempt without a grade', () => {
    const attempt = toCourseAttempt({
      ...ROW,
      status: AttemptStatus.InProgress,
      gradeScheme: null,
      gradeValue: null,
      creditsEarnedHundredths: null,
    });

    expect(attempt.grade).toBeNull();
    expect(attempt.creditsEarnedHundredths).toBeNull();
  });

  it('rejects a stored grade value without a scheme', () => {
    expect(() => toCourseAttempt({ ...ROW, gradeScheme: null })).toThrow(ZodError);
  });

  it('rejects a stored value that is not valid for its scheme', () => {
    expect(() => toCourseAttempt({ ...ROW, gradeValue: 'P' })).toThrow(ZodError);
  });

  it('rejects an in-progress attempt that carries a grade', () => {
    const row = { ...ROW, status: AttemptStatus.InProgress, creditsEarnedHundredths: null };

    expect(() => toCourseAttempt(row)).toThrow(ZodError);
  });
});
