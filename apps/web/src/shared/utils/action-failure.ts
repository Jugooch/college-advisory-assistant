/**
 * @file The serializable shape a server action returns when the API answered with an error.
 * @module @caa/web/shared/utils/action-failure
 * @see docs/standards/05-api-design.md
 */
import type { ApiError } from '@caa/api-contract';

/** An API error reduced to what a client component may show. */
export interface FailureResult {
  readonly kind: 'failed';
  readonly code: ApiError['code'];
  readonly message: string;
  readonly requestId: string | null;
}

/**
 * Builds the serializable part of a failure from an API error.
 *
 * @param error - The error the API returned.
 * @returns Code, message and support reference.
 */
export function toFailureResult(error: ApiError): FailureResult {
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}
