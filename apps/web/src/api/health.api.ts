/**
 * @file API calls for the health endpoint.
 * @module @caa/web/api/health
 */
import { getHealthEndpoint, type HealthResponse } from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Fetches the API health status.
 *
 * @returns The health payload.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function getHealth(): Promise<HealthResponse> {
  return apiClient.call(getHealthEndpoint);
}
