/**
 * @file API calls for saving plan drafts and listing a student's plans.
 * @module @caa/web/api/plan-drafts
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  listPlansEndpoint,
  type PlanListResponse,
  type PlanView,
  savePlanEndpoint,
  type SavePlanRequest,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Saves a schedule option, or a result with no options, as a plan draft. The server replays the
 * search, so this stores what the engine produces, never the client's result. Read-only toward
 * institutional systems: it registers nothing.
 *
 * @param studentId - Internal student ID. The API allows a save only for the session's own record.
 * @param request - The search request, the chosen sections, and the pinned inputs the student saw.
 * @returns The plan with its new latest revision, exactly as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope, such as 409 `REVISION_CONFLICT`.
 */
export async function savePlanDraft(
  studentId: string,
  request: SavePlanRequest,
): Promise<PlanView> {
  return apiClient.call(savePlanEndpoint, { params: { studentId }, body: request });
}

/**
 * Lists a student's plans, one per term.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @returns Each plan's latest revision, freshness, and open case status, as the API returned them.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function listPlans(studentId: string): Promise<PlanListResponse> {
  return apiClient.call(listPlansEndpoint, { params: { studentId } });
}
