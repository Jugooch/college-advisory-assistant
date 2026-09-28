/**
 * @file API calls for the current session.
 * @module @caa/web/api/session
 * @requirement FR-01
 */
import { getMeEndpoint, type MeResponse } from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Fetches who the API resolved the session cookie's token to.
 *
 * @returns The signed-in user's ID, institution, and roles.
 * @throws {ApiError} When the API responds with an error envelope, for example `UNAUTHORIZED`.
 */
export async function getMe(): Promise<MeResponse> {
  return apiClient.call(getMeEndpoint);
}
