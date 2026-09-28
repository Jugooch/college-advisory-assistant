/**
 * @file API calls for checking a candidate course set.
 * @module @caa/web/api/course-checks
 * @requirement FR-09
 * @requirement FR-10
 */
import {
  checkCoursesEndpoint,
  type CourseChecksRequest,
  type CourseChecksResponse,
} from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Checks a candidate course set for one student. Read-only: it registers nothing.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @param request - The courses to check together.
 * @returns Every check and the aggregate, exactly as the API returned them.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function checkCourses(
  studentId: string,
  request: CourseChecksRequest,
): Promise<CourseChecksResponse> {
  return apiClient.call(checkCoursesEndpoint, { params: { studentId }, body: request });
}
