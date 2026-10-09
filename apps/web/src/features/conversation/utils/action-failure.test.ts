/**
 * @file Tests for the shared action failure shape.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

import { toFailureResult } from './action-failure';

describe('toFailureResult', () => {
  it('keeps the code, message and support reference only', () => {
    const error = new ApiError({
      code: ErrorCode.InternalError,
      status: 500,
      message: 'down',
      requestId: 'req-1',
    });

    expect(toFailureResult(error)).toEqual({
      kind: 'failed',
      code: ErrorCode.InternalError,
      message: 'down',
      requestId: 'req-1',
    });
  });
});
