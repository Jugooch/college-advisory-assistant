/**
 * @file Tests that every API error code has a heading and a next step.
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';

import { describeError, ERROR_CODE_WORDING } from './error-code-wording';

const EVERY_CODE = Object.values(ErrorCode);

describe('ERROR_CODE_WORDING', () => {
  it.each(EVERY_CODE)('has a heading and a next step for %s', (code) => {
    const wording = describeError(code);

    expect(wording.heading.trim()).not.toBe('');
    expect(wording.nextStep.trim()).not.toBe('');
  });

  it('covers exactly the error codes in the domain registry', () => {
    expect(Object.keys(ERROR_CODE_WORDING).sort()).toEqual([...EVERY_CODE].sort());
  });

  it('does not suggest the record is wrong when the program is out of scope', () => {
    expect(describeError(ErrorCode.OutOfScope).nextStep).toContain(
      'This doesn’t mean your record is wrong',
    );
  });
});
