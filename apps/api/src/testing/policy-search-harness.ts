/**
 * @file Helpers for the policy search HTTP tests: the world app, the clock instant, and a GET.
 * Test code only.
 * @module @caa/api/testing/policy-search-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { bearer } from './fixtures';

/**
 * Sends `GET /v1/policies` with the given raw query string.
 *
 * @param app - App under test.
 * @param query - Query string without the leading question mark.
 * @param token - Dev token, or null for no session.
 * @returns The response.
 */
export function searchPolicies(
  app: FastifyInstance,
  query: string,
  token: string | null,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/v1/policies?${query}`,
    ...(token === null ? {} : { headers: bearer(token) }),
  });
}
