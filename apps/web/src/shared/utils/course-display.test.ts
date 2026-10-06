/**
 * @file Tests for naming courses by catalog code and title, with the ID as a stated fallback.
 */
import { describe, expect, it } from 'vitest';

import { type AcademicSummaryResponse, ApiError, type CourseDisplay } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { SYNTHETIC_COURSES } from '@caa/test-kit';

import { describeCourse, indexCourses, nameCourse, summaryCourses } from './course-display';

const { math101, math102 } = SYNTHETIC_COURSES;
const MATH_101: CourseDisplay = {
  courseId: math101.id,
  code: 'DEMO-MATH 101',
  title: 'Demo Calculus I',
  credits: { kind: 'FIXED', creditsHundredths: 300 },
};

describe('indexCourses', () => {
  it('is empty when no list was sent', () => {
    expect(indexCourses(undefined).size).toBe(0);
  });

  it('keeps the first entry for a course listed twice', () => {
    const other = { ...MATH_101, code: 'DEMO-MATH 101X' };

    expect(indexCourses([MATH_101], undefined, [other]).get(math101.id)?.code).toBe(
      'DEMO-MATH 101',
    );
  });
});

describe('nameCourse', () => {
  it('names a course with an entry by code and title', () => {
    expect(nameCourse(math101.id, indexCourses([MATH_101]))).toEqual({
      kind: 'catalog',
      code: 'DEMO-MATH 101',
      title: 'Demo Calculus I',
    });
  });

  it('falls back to the ID when there is no entry', () => {
    expect(nameCourse(math102.id, indexCourses([MATH_101]))).toEqual({
      kind: 'id-only',
      courseId: math102.id,
    });
  });
});

describe('describeCourse', () => {
  it.each([
    [MATH_101, 'DEMO-MATH 101 (Demo Calculus I)'],
    [{ ...MATH_101, title: null }, 'DEMO-MATH 101'],
  ])('describes %j', (entry, text) => {
    expect(describeCourse(math101.id, indexCourses([entry]))).toBe(text);
  });

  it('says plainly when a course has no catalog details', () => {
    expect(describeCourse(math102.id, indexCourses())).toBe(
      `course ${math102.id} (no catalog details available)`,
    );
  });
});

describe('summaryCourses', () => {
  it('indexes the summary entries, and nothing for an error', () => {
    const entry = {
      courseId: 'c1',
      code: 'DEMO 1',
      title: null,
      credits: { kind: 'FIXED', creditsHundredths: 300 },
    };
    const summary = { courses: [entry] } as unknown as AcademicSummaryResponse;
    const error = new ApiError({
      code: ErrorCode.SourceUnavailable,
      status: 503,
      message: 'down',
      requestId: null,
    });

    expect(summaryCourses(summary).get('c1')?.code).toBe('DEMO 1');
    expect(summaryCourses(error).size).toBe(0);
  });
});
