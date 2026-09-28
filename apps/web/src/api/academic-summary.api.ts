/**
 * @file API calls for the academic summary of one student.
 * @module @caa/web/api/academic-summary
 * @requirement FR-04
 * @requirement FR-05
 */
import { type AcademicSummaryResponse, getAcademicSummaryEndpoint } from '@caa/api-contract';

import { apiClient } from '@/lib/api-client';

/**
 * Fetches the pinned record, audit, and requirement states of one student.
 *
 * @param studentId - Internal student ID from the page URL. The API decides whether the session
 *   may see it.
 * @returns The academic summary, exactly as the API returned it.
 * @throws {ApiError} When the API responds with an error envelope.
 */
export async function getAcademicSummary(studentId: string): Promise<AcademicSummaryResponse> {
  return apiClient.call(getAcademicSummaryEndpoint, { params: { studentId } });
}
