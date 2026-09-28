/**
 * @file Tests for reading the student ID query parameter.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { readStudentIdQuery } from './student-id-query';

const STUDENT_ID = syntheticId('student', 1);

describe('readStudentIdQuery', () => {
  it('returns the parsed ID for a student ID, trimmed', () => {
    expect(readStudentIdQuery(` ${STUDENT_ID} `)).toEqual({ kind: 'valid', studentId: STUDENT_ID });
  });

  it.each([[undefined], [''], ['   ']])('is missing for %j', (value) => {
    expect(readStudentIdQuery(value)).toEqual({ kind: 'missing' });
  });

  it.each([['..'], ['SYN-000001'], [[STUDENT_ID, STUDENT_ID]]])('is invalid for %j', (value) => {
    expect(readStudentIdQuery(value)).toEqual({ kind: 'invalid' });
  });
});
