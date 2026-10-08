/**
 * @file Tests for the create-case states: what a created case and each API error turn into.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildCaseView } from '@caa/test-kit';

import { toCreatedState, toCreateFailedState } from './create-case-state';

describe('toCreatedState', () => {
  it('carries the status and time exactly as the API returned them', () => {
    const view = buildCaseView();

    expect(toCreatedState(view)).toEqual({
      kind: 'created',
      status: view.status,
      createdAt: view.createdAt,
    });
  });
});

describe('toCreateFailedState', () => {
  it('turns 409 REVISION_CONFLICT into the open-case-exists state', () => {
    const error = new ApiError({
      code: ErrorCode.RevisionConflict,
      status: 409,
      message: 'open case',
      requestId: null,
    });

    expect(toCreateFailedState(error)).toEqual({ kind: 'duplicate' });
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'keeps the API’s own %s error',
    (code) => {
      const error = new ApiError({ code, status: 404, message: 'API says', requestId: 'req-1' });

      expect(toCreateFailedState(error)).toEqual({
        kind: 'failed',
        code,
        message: 'API says',
        requestId: 'req-1',
      });
    },
  );
});
