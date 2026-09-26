/**
 * @file Error thrown by the API client when the API returns an error envelope.
 * @module @caa/api-contract/client/api-error
 */
import { ErrorCode } from '@caa/domain';

import { ErrorEnvelopeSchema } from '../envelope';

/** Fields that describe a failed API call. */
export interface ApiErrorDetails {
  readonly code: ErrorCode;
  /** HTTP status code. */
  readonly status: number;
  /** Human-readable message. Safe to show; contains no student data. */
  readonly message: string;
  /** Correlation ID for support, when the server supplied one. */
  readonly requestId: string | null;
}

/** A failed API call, carrying the server's error code and request ID. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly requestId: string | null;

  /**
   * Creates an ApiError from its details.
   *
   * @param details - Code, status, message, and request ID.
   */
  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.code = details.code;
    this.status = details.status;
    this.requestId = details.requestId;
  }

  /**
   * Builds an ApiError from any failed response body.
   *
   * @param body - Parsed JSON body, which may not match the envelope.
   * @param status - HTTP status code.
   * @returns An ApiError. Unrecognized bodies become INTERNAL_ERROR.
   */
  static fromResponseBody(body: unknown, status: number): ApiError {
    const parsed = ErrorEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      const message = 'Unexpected error response';
      return new ApiError({ code: ErrorCode.InternalError, status, message, requestId: null });
    }
    return new ApiError({ ...parsed.data.error, status });
  }
}
