/**
 * @file Tests for reading the course check page's query, one branch per case.
 */
import { describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { describeSelectionError, readCourseCheckQuery } from './course-check-query';

const STUDENT_ID = syntheticId('student', 1);
const { math101, math102 } = SYNTHETIC_COURSES;

describe('readCourseCheckQuery', () => {
  it('reports no submission when the picker was not submitted', () => {
    expect(readCourseCheckQuery({ studentId: STUDENT_ID })).toEqual({
      student: { kind: 'valid', studentId: STUDENT_ID },
      selectedCourseIds: [],
      selection: { kind: 'not-submitted' },
    });
  });

  it('reports an empty submission when the picker was submitted with nothing selected', () => {
    expect(readCourseCheckQuery({ studentId: STUDENT_ID, submitted: '1' }).selection).toEqual({
      kind: 'none-selected',
    });
  });

  it('builds the request from one selected course', () => {
    expect(readCourseCheckQuery({ studentId: STUDENT_ID, course: math101.id }).selection).toEqual({
      kind: 'valid',
      request: { courseIds: [math101.id] },
    });
  });

  it('drops repeated courses and keeps the submitted order', () => {
    const query = readCourseCheckQuery({
      studentId: STUDENT_ID,
      course: [math102.id, math101.id, math102.id],
    });

    expect(query.selectedCourseIds).toEqual([math102.id, math101.id]);
    expect(query.selection).toEqual({
      kind: 'valid',
      request: { courseIds: [math102.id, math101.id] },
    });
  });

  it('reports a value that is not a course ID', () => {
    expect(readCourseCheckQuery({ studentId: STUDENT_ID, course: 'MATH-101' }).selection).toEqual({
      kind: 'invalid-course',
    });
  });

  it('reports more than 12 courses with the count', () => {
    const course = Array.from({ length: 13 }, (_unused, index) => syntheticId('course', index + 1));

    expect(readCourseCheckQuery({ studentId: STUDENT_ID, course }).selection).toEqual({
      kind: 'too-many',
      count: 13,
    });
  });

  it.each([
    [{}, { kind: 'missing' }],
    [{ studentId: '..' }, { kind: 'invalid' }],
    [{ studentId: [STUDENT_ID, STUDENT_ID] }, { kind: 'invalid' }],
  ])('reads the student from %j as %j', (query, student) => {
    expect(readCourseCheckQuery(query).student).toEqual(student);
  });
});

describe('describeSelectionError', () => {
  it.each([
    [{ kind: 'not-submitted' } as const, null],
    [{ kind: 'none-selected' } as const, 'Choose at least one course.'],
    [{ kind: 'too-many', count: 13 } as const, 'Choose at most 12 courses. You chose 13.'],
    [
      { kind: 'invalid-course' } as const,
      'One of the selected values isn’t a course ID. Choose courses from the list.',
    ],
    [{ kind: 'valid', request: { courseIds: [math101.id] } } as const, null],
  ])('describes %j as %j', (selection, message) => {
    expect(describeSelectionError(selection)).toBe(message);
  });
});
