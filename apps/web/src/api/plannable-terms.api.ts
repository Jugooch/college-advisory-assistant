/**
 * @file API call for listing the terms a student can plan for.
 * @module @caa/web/api/plannable-terms
 * @requirement FR-08
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md (Amendment 6)
 */
import { getPlannableTermsEndpoint, type PlannableTermsResponse } from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Lists the terms the planner can offer one student. Read-only: it registers nothing.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @returns The plannable terms in the API's order; the list may be empty.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function getPlannableTerms(studentId: string): Promise<PlannableTermsResponse> {
  return apiClient.call(getPlannableTermsEndpoint, { params: { studentId } });
}
