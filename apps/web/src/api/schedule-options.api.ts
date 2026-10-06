/**
 * @file API calls for finding schedule options.
 * @module @caa/web/api/schedule-options
 * @requirement FR-08
 * @requirement FR-18
 */
import {
  findScheduleOptionsEndpoint,
  type ScheduleOptionsRequest,
  type ScheduleOptionsResponse,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Finds schedule options for one student. Read-only: it registers nothing.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @param request - The term, courses, credit choices, and confirmed constraints.
 * @returns The options and their states, exactly as the API returned them.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function findScheduleOptions(
  studentId: string,
  request: ScheduleOptionsRequest,
): Promise<ScheduleOptionsResponse> {
  return apiClient.call(findScheduleOptionsEndpoint, { params: { studentId }, body: request });
}
