/**
 * @file API calls for advisor cases: create, list, read, act on, and the advisor review queue.
 * @module @caa/web/api/cases
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  addCaseEventEndpoint,
  type CaseEventRequest,
  type CaseListResponse,
  type CaseQueueQuery,
  type CaseQueueResponse,
  type CaseView,
  createCaseEndpoint,
  type CreateCaseRequest,
  getCaseEndpoint,
  listAdvisorCasesEndpoint,
  listStudentCasesEndpoint,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Opens an advisor case for the signed-in student. App-internal: nothing is sent outside the app,
 * and no institutional record changes.
 *
 * @param studentId - Internal student ID. The API allows a case only for the session's own record.
 * @param request - The reason, the plan revision or discrepancy subject, and the student's note.
 * @returns The new case, as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope, such as 409 `REVISION_CONFLICT`
 *   when the plan already has an open case.
 */
export async function createCase(studentId: string, request: CreateCaseRequest): Promise<CaseView> {
  return apiClient.call(createCaseEndpoint, { params: { studentId }, body: request });
}

/**
 * Lists the student's cases, newest first.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @returns One summary row per case, without note text.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function listStudentCases(studentId: string): Promise<CaseListResponse> {
  return apiClient.call(listStudentCasesEndpoint, { params: { studentId } });
}

/**
 * Reads one case with its events, its frozen plan revision, and the actions the session may take.
 *
 * @param caseId - The case's ID.
 * @returns The case view exactly as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope. A missing case and one the
 *   session may not see are both 404.
 */
export async function getCase(caseId: string): Promise<CaseView> {
  return apiClient.call(getCaseEndpoint, { params: { caseId } });
}

/**
 * Sends one action on a case, for example `WITHDRAW`. The API's case logic decides whether the
 * session may take it now.
 *
 * @param caseId - The case's ID.
 * @param request - The action and the `lastSequence` the caller saw.
 * @returns The updated case view.
 * @throws {ApiError} When the API responds with an error envelope, such as 409
 *   `REVISION_CONFLICT` when the case changed since it was read.
 */
export async function addCaseEvent(caseId: string, request: CaseEventRequest): Promise<CaseView> {
  return apiClient.call(addCaseEventEndpoint, { params: { caseId }, body: request });
}

/**
 * Lists the advisor or admin review queue, oldest first.
 *
 * @param query - Optional filters. `unrouted` is admin-only: the API answers 404 to an advisor.
 *   Tenant and the advisor's assignments come from the session, never from this query.
 * @returns One row per case, without note text.
 * @throws {ApiError} When the API responds with an error envelope, for example `NOT_FOUND` for a
 *   student.
 */
export async function listAdvisorCases(query: CaseQueueQuery = {}): Promise<CaseQueueResponse> {
  // The endpoint's query schema takes the string form of the flag, as it appears in the URL.
  const wire = {
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.unrouted === undefined
      ? {}
      : { unrouted: query.unrouted ? ('true' as const) : ('false' as const) }),
  };
  return apiClient.call(listAdvisorCasesEndpoint, { query: wire });
}
