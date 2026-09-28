/**
 * @file Keeps an API error envelope as a value for the page to show, and lets any other failure
 * reach the error boundary.
 * @module @caa/web/shared/utils/keep-api-error
 * @see docs/standards/05-api-design.md
 */
import { ApiError } from '@caa/api-contract';

/**
 * Awaits an API call, returning its error envelope instead of throwing it.
 *
 * @param call - The pending API call.
 * @returns The call's result, or the `ApiError` it failed with.
 * @throws {Error} Any failure that isn't an `ApiError`, such as a lost connection.
 */
export async function keepApiError<T>(call: Promise<T>): Promise<T | ApiError> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
}
