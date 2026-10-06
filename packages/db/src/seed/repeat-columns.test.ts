/**
 * @file Unit tests for flattening a repeat statement into table columns.
 */
import { describe, expect, it } from 'vitest';

import { toRepeatColumns } from './repeat-columns';

describe('toRepeatColumns', () => {
  const NOT_REPEATABLE = {
    repeatableForCredit: false,
    repeatMaxAttempts: null,
    repeatMaxCreditsHundredths: null,
  };

  it('treats null as not repeatable with no caps', () => {
    expect(toRepeatColumns(null)).toEqual(NOT_REPEATABLE);
  });

  it('treats a missing value as not repeatable with no caps', () => {
    expect(toRepeatColumns(undefined)).toEqual(NOT_REPEATABLE);
  });

  it('keeps the caps of a repeatable course', () => {
    expect(toRepeatColumns({ maxAttempts: 3, maxCreditsHundredths: 900 })).toEqual({
      repeatableForCredit: true,
      repeatMaxAttempts: 3,
      repeatMaxCreditsHundredths: 900,
    });
  });

  it('keeps a repeatable course that has no caps', () => {
    expect(toRepeatColumns({ maxAttempts: null, maxCreditsHundredths: null })).toEqual({
      repeatableForCredit: true,
      repeatMaxAttempts: null,
      repeatMaxCreditsHundredths: null,
    });
  });
});
