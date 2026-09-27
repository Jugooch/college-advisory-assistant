/**
 * @file Tests for the synthetic grade builder and its shorthands.
 */
import { describe, expect, it } from 'vitest';

import { GradeSchema, GradeScheme } from '@caa/domain';

import { buildGrade, fail, letter, pass } from './grade.builder';

describe('buildGrade', () => {
  it('defaults to a letter B', () => {
    expect(buildGrade()).toEqual({ scheme: 'LETTER', value: 'B' });
  });

  it('returns deep-equal grades for the same arguments', () => {
    expect(buildGrade({ scheme: GradeScheme.Numeric, value: '87.5' })).toEqual(
      buildGrade({ scheme: GradeScheme.Numeric, value: '87.5' }),
    );
  });

  it('builds the given grade instead of the default', () => {
    expect(buildGrade({ scheme: GradeScheme.Unknown, value: 'XP' })).toEqual({
      scheme: 'UNKNOWN',
      value: 'XP',
    });
  });

  it('returns a grade that passes the domain schema', () => {
    expect(GradeSchema.safeParse(buildGrade()).success).toBe(true);
  });

  it('rejects a value the scheme forbids', () => {
    expect(() => buildGrade({ scheme: GradeScheme.Letter, value: 'P' as 'A' })).toThrow();
  });
});

describe('letter', () => {
  it('builds a letter grade with the given value', () => {
    expect(letter('C-')).toEqual({ scheme: 'LETTER', value: 'C-' });
  });
});

describe('pass', () => {
  it('builds a pass/fail P', () => {
    expect(pass()).toEqual({ scheme: 'PASS_FAIL', value: 'P' });
  });
});

describe('fail', () => {
  it('builds a pass/fail F, not a letter F', () => {
    expect(fail()).toEqual({ scheme: 'PASS_FAIL', value: 'F' });
  });
});
