/**
 * @file Tests for the withdraw action's wiring: it sends a WITHDRAW event with the sequence the
 * student saw, and returns each result and error to the form.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildCaseView, syntheticId } from '@caa/test-kit';

import { addCaseEvent } from '@/api/cases.api';

import {
  IDLE_WITHDRAW_STATE,
  WITHDRAW_CASE_FIELD,
  WITHDRAW_SEQUENCE_FIELD,
} from '../utils/withdraw-case-state';
import { withdrawCaseAction } from './withdraw-case.action';

vi.mock('@/api/cases.api', () => ({ addCaseEvent: vi.fn() }));

const CASE_ID = syntheticId('advisingCase', 1);
const FORM = new FormData();
FORM.set(WITHDRAW_CASE_FIELD, CASE_ID);
FORM.set(WITHDRAW_SEQUENCE_FIELD, '1');

describe('withdrawCaseAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends WITHDRAW with the sequence the student saw', async () => {
    vi.mocked(addCaseEvent).mockResolvedValue(buildCaseView());

    const state = await withdrawCaseAction(IDLE_WITHDRAW_STATE, FORM);

    expect(addCaseEvent).toHaveBeenCalledWith(CASE_ID, { action: 'WITHDRAW', expectedSequence: 1 });
    expect(state).toEqual({ kind: 'withdrawn' });
  });

  it('returns the changed state on 409', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(
      new ApiError({
        code: ErrorCode.RevisionConflict,
        status: 409,
        message: 'race',
        requestId: null,
      }),
    );

    await expect(withdrawCaseAction(IDLE_WITHDRAW_STATE, FORM)).resolves.toEqual({
      kind: 'changed',
    });
  });

  it('returns the API’s own 404 error', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(
      new ApiError({ code: ErrorCode.NotFound, status: 404, message: 'gone', requestId: null }),
    );

    await expect(withdrawCaseAction(IDLE_WITHDRAW_STATE, FORM)).resolves.toMatchObject({
      kind: 'failed',
      code: ErrorCode.NotFound,
    });
  });

  it('sends nothing when the form doesn’t parse', async () => {
    await expect(withdrawCaseAction(IDLE_WITHDRAW_STATE, new FormData())).resolves.toEqual({
      kind: 'rejected',
    });
    expect(addCaseEvent).not.toHaveBeenCalled();
  });
});
