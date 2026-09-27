/**
 * @file Tests for the grade data object.
 */
import { describe, expect, it } from 'vitest';

import { GradeScheme, LetterGrade, PassFailGrade } from '../enums/grade-scheme.enum';
import { createGrade, GradeSchema } from './grade.model';

describe('createGrade', () => {
  it('accepts a letter grade', () => {
    expect(createGrade({ scheme: GradeScheme.Letter, value: LetterGrade.BMinus })).toEqual({
      scheme: 'LETTER',
      value: 'B-',
    });
  });

  it('accepts every letter value from A+ to F', () => {
    const values = Object.values(LetterGrade).map(
      (value) => createGrade({ scheme: GradeScheme.Letter, value }).value,
    );

    expect(values).toEqual([
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'B-',
      'C+',
      'C',
      'C-',
      'D+',
      'D',
      'D-',
      'F',
    ]);
  });

  it('accepts P under PASS_FAIL', () => {
    expect(createGrade({ scheme: GradeScheme.PassFail, value: PassFailGrade.Pass })).toEqual({
      scheme: 'PASS_FAIL',
      value: 'P',
    });
  });

  it('accepts F under PASS_FAIL', () => {
    expect(createGrade({ scheme: GradeScheme.PassFail, value: 'F' }).value).toBe('F');
  });

  it('accepts a numeric grade as a decimal string', () => {
    expect(createGrade({ scheme: GradeScheme.Numeric, value: '87.5' })).toEqual({
      scheme: 'NUMERIC',
      value: '87.5',
    });
  });

  it('keeps the raw source value under the UNKNOWN scheme', () => {
    expect(createGrade({ scheme: GradeScheme.Unknown, value: 'WP' })).toEqual({
      scheme: 'UNKNOWN',
      value: 'WP',
    });
  });

  it('rejects P as a letter grade', () => {
    expect(() => createGrade({ scheme: GradeScheme.Letter, value: 'P' as LetterGrade })).toThrow();
  });

  it('rejects a letter grade outside the closed set', () => {
    expect(() => createGrade({ scheme: GradeScheme.Letter, value: 'E' as LetterGrade })).toThrow();
  });

  it('rejects a letter value under PASS_FAIL', () => {
    expect(() =>
      createGrade({ scheme: GradeScheme.PassFail, value: 'A' as PassFailGrade }),
    ).toThrow();
  });

  it('rejects a lowercase pass/fail value', () => {
    expect(() =>
      createGrade({ scheme: GradeScheme.PassFail, value: 'p' as PassFailGrade }),
    ).toThrow();
  });

  it('rejects a numeric grade that is not a decimal string', () => {
    expect(() => createGrade({ scheme: GradeScheme.Numeric, value: '87,5' })).toThrow(/decimal/);
  });

  it('rejects a negative numeric grade', () => {
    expect(() => createGrade({ scheme: GradeScheme.Numeric, value: '-1' })).toThrow(/decimal/);
  });

  it('rejects an empty value under the UNKNOWN scheme', () => {
    expect(() => createGrade({ scheme: GradeScheme.Unknown, value: '' })).toThrow();
  });
});

describe('GradeSchema', () => {
  it('rejects an unrecognized scheme', () => {
    expect(GradeSchema.safeParse({ scheme: 'GPA', value: 'A' }).success).toBe(false);
  });

  it('rejects a numeric grade supplied as a float', () => {
    expect(GradeSchema.safeParse({ scheme: 'NUMERIC', value: 87.5 }).success).toBe(false);
  });
});
