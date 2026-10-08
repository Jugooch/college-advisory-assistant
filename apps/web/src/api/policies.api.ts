/**
 * @file API call for approved policy search, used by policy help and the where-to-ask list.
 * @module @caa/web/api/policies
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import {
  type PolicySearchQuery,
  type PolicySearchResponse,
  searchPoliciesEndpoint,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Searches approved policy documents. Tenant, audience and role come from the session on the
 * server, never from this query.
 *
 * @param query - The search text, a topic, or both. At least one is required.
 * @returns At most three approved hits and the instant the server judged them at.
 * @throws {ApiError} When the API responds with an error envelope, such as 400 for a bad query.
 */
export async function searchPolicies(query: PolicySearchQuery): Promise<PolicySearchResponse> {
  return apiClient.call(searchPoliciesEndpoint, { query });
}
