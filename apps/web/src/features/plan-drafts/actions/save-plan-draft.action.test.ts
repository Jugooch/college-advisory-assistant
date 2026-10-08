/**
 * @file Tests for the save-draft action's wiring: what it sends to the API and how each result
 * and error is returned to the form.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, ScheduleOptionsRequestSchema } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import {
  buildPlanView,
  buildScheduleConstraintSet,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  syntheticId,
} from '@caa/test-kit';

import { savePlanDraft } from '@/api/plan-drafts.api';

import {
  DRAFT_FIELD,
  encodeSaveDraft,
  optionSectionIds,
  STUDENT_FIELD,
} from '../utils/save-draft-form';
import { IDLE_SAVE_DRAFT_STATE } from '../utils/save-draft-state';
import { savePlanDraftAction } from './save-plan-draft.action';

vi.mock('@/api/plan-drafts.api', () => ({ savePlanDraft: vi.fn() }));

const STUDENT_ID = syntheticId('student', 1);
const RESULT = buildScheduleOptionsResponse();
const BODY = {
  request: ScheduleOptionsRequestSchema.parse({
    termId: RESULT.term.id,
    courseIds: RESULT.courseIds,
    creditSelections: [],
    constraints: buildScheduleConstraintSet(),
  }),
  selectedSectionIds: optionSectionIds(buildScheduleOption()),
  expectedPinnedInputs: RESULT.pinnedInputs,
};
const FORM = new FormData();
FORM.set(STUDENT_FIELD, STUDENT_ID);
FORM.set(DRAFT_FIELD, encodeSaveDraft(BODY));

/**
 * Builds an API error envelope.
 *
 * @param code - The error code.
 * @returns The error.
 */
function apiError(code: ApiError['code']): ApiError {
  return new ApiError({ code, status: 409, message: 'API says', requestId: 'req-9' });
}

describe('savePlanDraftAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends the exact request, sections, and pinned inputs for the student', async () => {
    vi.mocked(savePlanDraft).mockResolvedValue(buildPlanView());

    const state = await savePlanDraftAction(IDLE_SAVE_DRAFT_STATE, FORM);

    expect(savePlanDraft).toHaveBeenCalledWith(STUDENT_ID, BODY);
    expect(state).toMatchObject({ kind: 'saved', revision: 1 });
  });

  it('returns the conflict state on REVISION_CONFLICT', async () => {
    vi.mocked(savePlanDraft).mockRejectedValue(apiError(ErrorCode.RevisionConflict));

    await expect(savePlanDraftAction(IDLE_SAVE_DRAFT_STATE, FORM)).resolves.toEqual({
      kind: 'conflict',
    });
  });

  it.each([ErrorCode.StaleSource, ErrorCode.SourceUnavailable])(
    'returns the API’s own %s error',
    async (code) => {
      vi.mocked(savePlanDraft).mockRejectedValue(apiError(code));

      await expect(savePlanDraftAction(IDLE_SAVE_DRAFT_STATE, FORM)).resolves.toEqual({
        kind: 'failed',
        code,
        message: 'API says',
        requestId: 'req-9',
      });
    },
  );

  it('sends nothing when the form doesn’t parse', async () => {
    const bad = new FormData();
    bad.set(STUDENT_FIELD, STUDENT_ID);
    bad.set(DRAFT_FIELD, '{"tenantId":"x"}');

    await expect(savePlanDraftAction(IDLE_SAVE_DRAFT_STATE, bad)).resolves.toEqual({
      kind: 'rejected',
    });
    expect(savePlanDraft).not.toHaveBeenCalled();
  });

  it('lets a failure that isn’t an API error reach the error boundary', async () => {
    vi.mocked(savePlanDraft).mockRejectedValue(new Error('connection lost'));

    await expect(savePlanDraftAction(IDLE_SAVE_DRAFT_STATE, FORM)).rejects.toThrow(
      'connection lost',
    );
  });
});
