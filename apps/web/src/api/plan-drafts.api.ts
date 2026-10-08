/**
 * @file API calls for saving, listing, reading, and revalidating a student's plan drafts.
 * @module @caa/web/api/plan-drafts
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  getPlanEndpoint,
  getPlanRevisionEndpoint,
  listPlansEndpoint,
  type PlanListResponse,
  type PlanRevisionView,
  type PlanView,
  revalidatePlanEndpoint,
  type RevalidatePlanRequest,
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

/**
 * Reads one plan: its latest revision in full and the index of every revision. A stale or
 * unknown revision is still returned, as history.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param planId - The plan's ID from the page URL.
 * @returns The plan, exactly as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope, such as 404.
 */
export async function getPlan(studentId: string, planId: string): Promise<PlanView> {
  return apiClient.call(getPlanEndpoint, { params: { studentId, planId } });
}

/**
 * Reads one earlier (or the latest) revision of a plan, in full and read-only.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param planId - The plan's ID from the page URL.
 * @param revision - The revision number, from 1.
 * @returns The revision with its freshness, exactly as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope, such as 404.
 */
export async function getPlanRevision(
  studentId: string,
  planId: string,
  revision: number,
): Promise<PlanRevisionView> {
  return apiClient.call(getPlanRevisionEndpoint, {
    params: { studentId, planId, revision: String(revision) },
  });
}

/**
 * Asks the server to replay the latest revision's inputs on current records and append a new
 * revision. Read-only toward institutional systems: it registers nothing.
 *
 * @param studentId - Internal student ID. The API allows this only for the session's own record.
 * @param planId - The plan's ID.
 * @param request - The revision the student was looking at.
 * @returns The plan with its new latest revision.
 * @throws {ApiError} 409 `REVISION_CONFLICT` when a newer revision exists; 409 `STALE_SOURCE` or
 *   503 `SOURCE_UNAVAILABLE` when current records can't be used. Nothing is written in those cases.
 */
export async function revalidatePlan(
  studentId: string,
  planId: string,
  request: RevalidatePlanRequest,
): Promise<PlanView> {
  return apiClient.call(revalidatePlanEndpoint, {
    params: { studentId, planId },
    body: request,
  });
}
