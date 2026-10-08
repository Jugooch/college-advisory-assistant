/**
 * @file Tests for the withdraw form: parsing the case and sequence, and the error states.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import {
  parseWithdrawForm,
  toWithdrawFailedState,
  WITHDRAW_CASE_FIELD,
  WITHDRAW_SEQUENCE_FIELD,
} from './withdraw-case-state';

/**
 * Builds a withdraw form.
 *
 * @param caseId - The case field.
 * @param sequence - The sequence field.
 * @returns The form data.
 */
function form(caseId: string, sequence: string): FormData {
  const data = new FormData();
  data.set(WITHDRAW_CASE_FIELD, caseId);
  data.set(WITHDRAW_SEQUENCE_FIELD, sequence);
  return data;
}

describe('parseWithdrawForm', () => {
  it('reads the case and the sequence the student saw', () => {
    const caseId = syntheticId('advisingCase', 1);

    expect(parseWithdrawForm(form(caseId, '2'))).toEqual({ caseId, expectedSequence: 2 });
  });

  it.each([
    ['a bad case ID', 'nope', '1'],
    ['zero', syntheticId('advisingCase', 1), '0'],
    ['a negative number', syntheticId('advisingCase', 1), '-1'],
    ['text', syntheticId('advisingCase', 1), 'two'],
  ])('returns null for %s', (_name, caseId, sequence) => {
    expect(parseWithdrawForm(form(caseId, sequence))).toBeNull();
  });
});

describe('toWithdrawFailedState', () => {
  it('turns 409 into the changed state', () => {
    const error = new ApiError({
      code: ErrorCode.RevisionConflict,
      status: 409,
      message: 'race',
      requestId: null,
    });

    expect(toWithdrawFailedState(error)).toEqual({ kind: 'changed' });
  });

  it('keeps any other error as the API returned it', () => {
    const error = new ApiError({
      code: ErrorCode.NotFound,
      status: 404,
      message: 'gone',
      requestId: 'req-2',
    });

    expect(toWithdrawFailedState(error)).toEqual({
      kind: 'failed',
      code: ErrorCode.NotFound,
      message: 'gone',
      requestId: 'req-2',
    });
  });
});
