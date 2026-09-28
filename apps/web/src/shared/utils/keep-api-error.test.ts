/**
 * @file Tests for keeping API error envelopes as values.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

import { keepApiError } from './keep-api-error';

describe('keepApiError', () => {
  it('returns the result of a successful call', async () => {
    await expect(keepApiError(Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('returns an API error envelope as a value', async () => {
    const error = new ApiError({
      code: ErrorCode.StaleSource,
      status: 409,
      message: 'Your record is being refreshed.',
      requestId: 'req-syn-003',
    });

    await expect(keepApiError(Promise.reject(error))).resolves.toBe(error);
  });

  it('rethrows any other failure for the error boundary', async () => {
    const failure = new TypeError('fetch failed');

    await expect(keepApiError(Promise.reject(failure))).rejects.toBe(failure);
  });
});
