/**
 * @file Shared helpers for the academic summary HTTP tests: the request, and the fields of the
 * success body they read. Test code only.
 * @module @caa/api/testing/academic-summary-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import { bearer } from './fixtures';

/**
 * Requests one student's academic summary from an app with a dev token.
 *
 * @param app - The app under test.
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token, or `null` for no session.
 * @returns The injected response.
 */
export function getAcademicSummary(
  app: FastifyInstance,
  studentId: string,
  token: string | null,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}/academic-summary`,
    headers: token === null ? {} : bearer(token),
  });
}

/** The fields of the success envelope the summary tests read; other fields pass through. */
export const SummaryBodySchema = z.object({
  data: z.looseObject({
    audit: z.unknown(),
    auditReflectsRecord: z.unknown(),
    programCatalogConsistency: z.unknown(),
    requirements: z.array(z.looseObject({ state: z.string() })),
  }),
});
