/**
 * @file Tests for the create-case action's wiring: what it sends to the API and how each result
 * and error is returned to the form.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildCaseView, syntheticId } from '@caa/test-kit';

import { createCase } from '@/api/cases.api';

import { buildDiscrepancyRequest } from '../utils/case-request';
import {
  CASE_REQUEST_FIELD,
  CASE_STUDENT_FIELD,
  encodeCaseRequest,
} from '../utils/create-case-form';
import { IDLE_CREATE_CASE_STATE } from '../utils/create-case-state';
import { createCaseAction } from './create-case.action';

vi.mock('@/api/cases.api', () => ({ createCase: vi.fn() }));

const STUDENT_ID = syntheticId('student', 1);
const BODY = buildDiscrepancyRequest('AUDIT_REQUIREMENT', 'My elective is not counted.');
const FORM = new FormData();
FORM.set(CASE_STUDENT_FIELD, STUDENT_ID);
FORM.set(CASE_REQUEST_FIELD, encodeCaseRequest(BODY));

describe('createCaseAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends exactly the previewed request for the student', async () => {
    vi.mocked(createCase).mockResolvedValue(buildCaseView());

    const state = await createCaseAction(IDLE_CREATE_CASE_STATE, FORM);

    expect(createCase).toHaveBeenCalledWith(STUDENT_ID, BODY);
    expect(state).toMatchObject({ kind: 'created', status: 'OPEN' });
  });

  it('returns the duplicate state on 409 REVISION_CONFLICT', async () => {
    vi.mocked(createCase).mockRejectedValue(
      new ApiError({
        code: ErrorCode.RevisionConflict,
        status: 409,
        message: 'open case',
        requestId: null,
      }),
    );

    await expect(createCaseAction(IDLE_CREATE_CASE_STATE, FORM)).resolves.toEqual({
      kind: 'duplicate',
    });
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'returns the API’s own %s error',
    async (code) => {
      vi.mocked(createCase).mockRejectedValue(
        new ApiError({ code, status: 503, message: 'API says', requestId: 'req-9' }),
      );

      await expect(createCaseAction(IDLE_CREATE_CASE_STATE, FORM)).resolves.toMatchObject({
        kind: 'failed',
        code,
        requestId: 'req-9',
      });
    },
  );

  it('sends nothing when the form doesn’t parse', async () => {
    await expect(createCaseAction(IDLE_CREATE_CASE_STATE, new FormData())).resolves.toEqual({
      kind: 'rejected',
    });
    expect(createCase).not.toHaveBeenCalled();
  });

  it('lets a non-API failure reach the error boundary', async () => {
    vi.mocked(createCase).mockRejectedValue(new TypeError('connection lost'));

    await expect(createCaseAction(IDLE_CREATE_CASE_STATE, FORM)).rejects.toThrow('connection lost');
  });
});
