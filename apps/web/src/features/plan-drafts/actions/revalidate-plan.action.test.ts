/**
 * @file Tests for the revalidate action's wiring: what it sends to the API and how each result
 * and error is returned to the form.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import {
  buildPlanRevisionView,
  buildPlanView,
  buildResultUnavailablePlanRevisionView,
  syntheticId,
} from '@caa/test-kit';

import { revalidatePlan } from '@/api/plan-drafts.api';

import {
  REVALIDATE_PLAN_FIELD,
  REVALIDATE_REVISION_FIELD,
  REVALIDATE_SELECTION_FIELD,
  REVALIDATE_STUDENT_FIELD,
} from '../utils/revalidate-form';
import { IDLE_REVALIDATE_STATE } from '../utils/revalidate-state';
import { revalidatePlanAction } from './revalidate-plan.action';

vi.mock('@/api/plan-drafts.api', () => ({ revalidatePlan: vi.fn() }));

const STUDENT_ID = syntheticId('student', 1);
const PLAN_ID = syntheticId('plan', 1);
const FORM = new FormData();
FORM.set(REVALIDATE_STUDENT_FIELD, STUDENT_ID);
FORM.set(REVALIDATE_PLAN_FIELD, PLAN_ID);
FORM.set(REVALIDATE_REVISION_FIELD, '1');
FORM.set(REVALIDATE_SELECTION_FIELD, 'true');

/**
 * Builds an API error envelope.
 *
 * @param code - The error code.
 * @param status - The HTTP status.
 * @returns The error.
 */
function apiError(code: ApiError['code'], status = 409): ApiError {
  return new ApiError({ code, status, message: 'API says', requestId: 'req-9' });
}

describe('revalidatePlanAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends expectedRevision for the student’s plan and reports the new revision', async () => {
    vi.mocked(revalidatePlan).mockResolvedValue(
      buildPlanView({ latest: buildPlanRevisionView({ revision: 2, cause: 'REVALIDATED' }) }),
    );

    const state = await revalidatePlanAction(IDLE_REVALIDATE_STATE, FORM);

    expect(revalidatePlan).toHaveBeenCalledWith(STUDENT_ID, PLAN_ID, { expectedRevision: 1 });
    expect(state).toEqual({ kind: 'revalidated', revision: 2, selection: 'carried' });
  });

  it('says the earlier choice must be made again when the new revision has none', async () => {
    vi.mocked(revalidatePlan).mockResolvedValue(
      buildPlanView({
        latest: buildResultUnavailablePlanRevisionView({
          revision: 2,
          cause: 'REVALIDATED',
          outcome: 'NO_FEASIBLE_PLAN',
          selectedSectionIds: null,
        }),
      }),
    );

    await expect(revalidatePlanAction(IDLE_REVALIDATE_STATE, FORM)).resolves.toMatchObject({
      selection: 'chosen-again',
    });
  });

  it('returns the conflict state on REVISION_CONFLICT', async () => {
    vi.mocked(revalidatePlan).mockRejectedValue(apiError(ErrorCode.RevisionConflict));

    await expect(revalidatePlanAction(IDLE_REVALIDATE_STATE, FORM)).resolves.toEqual({
      kind: 'conflict',
    });
  });

  it.each([
    [ErrorCode.StaleSource, 409],
    [ErrorCode.SourceUnavailable, 503],
  ])('returns the referral on %s', async (code, status) => {
    vi.mocked(revalidatePlan).mockRejectedValue(apiError(code, status));

    await expect(revalidatePlanAction(IDLE_REVALIDATE_STATE, FORM)).resolves.toEqual({
      kind: 'blocked',
      code,
    });
  });

  it('sends nothing when the form doesn’t parse', async () => {
    const bad = new FormData();
    bad.set(REVALIDATE_STUDENT_FIELD, STUDENT_ID);

    await expect(revalidatePlanAction(IDLE_REVALIDATE_STATE, bad)).resolves.toEqual({
      kind: 'rejected',
    });
    expect(revalidatePlan).not.toHaveBeenCalled();
  });

  it('lets a failure that isn’t an API error reach the error boundary', async () => {
    vi.mocked(revalidatePlan).mockRejectedValue(new Error('connection lost'));

    await expect(revalidatePlanAction(IDLE_REVALIDATE_STATE, FORM)).rejects.toThrow(
      'connection lost',
    );
  });
});
