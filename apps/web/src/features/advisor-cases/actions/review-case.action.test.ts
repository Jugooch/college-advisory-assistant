/**
 * @file Tests for the review action's wiring: it sends the parsed event with the sequence the
 * advisor saw, refreshes the pages when the case changed, and returns each result to the screen.
 */
import { revalidatePath } from 'next/cache';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildInReviewCaseView, syntheticId } from '@caa/test-kit';

import { addCaseEvent } from '@/api/cases.api';

import {
  IDLE_REVIEW_STATE,
  REVIEW_ACTION_FIELD,
  REVIEW_CASE_FIELD,
  REVIEW_NOTE_FIELD,
  REVIEW_RESOLUTION_FIELD,
  REVIEW_SEQUENCE_FIELD,
} from '../utils/review-case-state';
import { reviewCaseAction } from './review-case.action';

vi.mock('@/api/cases.api', () => ({ addCaseEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const CASE_ID = syntheticId('advisingCase', 1);

/**
 * Builds a review form.
 *
 * @param fields - Field values by name, beyond the case and the sequence.
 * @returns The form data.
 */
function form(fields: Readonly<Record<string, string>>): FormData {
  const data = new FormData();
  data.set(REVIEW_CASE_FIELD, CASE_ID);
  data.set(REVIEW_SEQUENCE_FIELD, '3');
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

/**
 * Builds an API error.
 *
 * @param code - The error code.
 * @param status - The HTTP status.
 * @returns The error.
 */
function apiError(code: ErrorCode, status: number): ApiError {
  return new ApiError({ code, status, message: 'm', requestId: 'req-9' });
}

describe('reviewCaseAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('claims with the sequence the advisor saw, then refreshes the case and the queue', async () => {
    vi.mocked(addCaseEvent).mockResolvedValue(buildInReviewCaseView());

    const state = await reviewCaseAction(
      IDLE_REVIEW_STATE,
      form({ [REVIEW_ACTION_FIELD]: 'CLAIM' }),
    );

    expect(addCaseEvent).toHaveBeenCalledWith(CASE_ID, { action: 'CLAIM', expectedSequence: 3 });
    expect(state).toEqual({ kind: 'done', action: 'CLAIM', expectedSequence: 3 });
    expect(revalidatePath).toHaveBeenCalledWith(`/advisor/cases/${CASE_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith('/advisor/queue');
  });

  it('resolves with the code and the note', async () => {
    vi.mocked(addCaseEvent).mockResolvedValue(buildInReviewCaseView());

    await reviewCaseAction(
      IDLE_REVIEW_STATE,
      form({
        [REVIEW_ACTION_FIELD]: 'RESOLVE',
        [REVIEW_RESOLUTION_FIELD]: 'STUDENT_ACTION_NEEDED',
        [REVIEW_NOTE_FIELD]: 'Please see me.',
      }),
    );

    expect(addCaseEvent).toHaveBeenCalledWith(CASE_ID, {
      action: 'RESOLVE',
      expectedSequence: 3,
      resolution: 'STUDENT_ACTION_NEEDED',
      note: 'Please see me.',
    });
  });

  it('returns changed on 409 and refreshes so the page shows the latest', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(apiError(ErrorCode.RevisionConflict, 409));

    const state = await reviewCaseAction(
      IDLE_REVIEW_STATE,
      form({ [REVIEW_ACTION_FIELD]: 'CLAIM' }),
    );

    expect(state).toEqual({ kind: 'changed', expectedSequence: 3 });
    expect(revalidatePath).toHaveBeenCalledWith(`/advisor/cases/${CASE_ID}`);
  });

  it('returns gone on 404 without refreshing, so the case is not fetched again', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(apiError(ErrorCode.NotFound, 404));

    const state = await reviewCaseAction(
      IDLE_REVIEW_STATE,
      form({ [REVIEW_ACTION_FIELD]: 'CLAIM' }),
    );

    expect(state).toEqual({ kind: 'gone' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns any other API error as it came', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(apiError(ErrorCode.InvalidRequest, 400));

    const state = await reviewCaseAction(
      IDLE_REVIEW_STATE,
      form({ [REVIEW_ACTION_FIELD]: 'CLAIM' }),
    );

    expect(state).toEqual({
      kind: 'failed',
      code: ErrorCode.InvalidRequest,
      message: 'm',
      requestId: 'req-9',
    });
  });

  it('sends nothing when the form does not parse', async () => {
    const state = await reviewCaseAction(IDLE_REVIEW_STATE, new FormData());

    expect(state).toEqual({ kind: 'rejected' });
    expect(addCaseEvent).not.toHaveBeenCalled();
  });

  it('lets a lost connection throw instead of hiding it', async () => {
    vi.mocked(addCaseEvent).mockRejectedValue(new Error('down'));

    await expect(
      reviewCaseAction(IDLE_REVIEW_STATE, form({ [REVIEW_ACTION_FIELD]: 'CLAIM' })),
    ).rejects.toThrow('down');
  });
});
