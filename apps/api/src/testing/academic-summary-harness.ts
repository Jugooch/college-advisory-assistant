/**
 * @file Shared helpers for the academic summary HTTP tests: the request, and the fields of the
 * success body they read. Test code only.
 * @module @caa/api/testing/academic-summary-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import { type Course, createProgram, type Program } from '@caa/domain';
import { SYNTHETIC_COURSES, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

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

/**
 * Builds the catalog the summary tests read: every synthetic course with a title, and the named
 * program the default record snapshot and audit cite, all in tenant A.
 *
 * @returns The courses and programs to assign to the in-memory store.
 */
export function withCatalogNames(): { courses: Course[]; programs: Program[] } {
  return {
    courses: Object.values(SYNTHETIC_COURSES).map((course) => ({
      ...course,
      title: `Title ${course.label}`,
    })),
    programs: [
      createProgram({
        id: syntheticId('program', 1),
        tenantId: SYNTHETIC_TENANTS.a.id,
        sourceProgramId: 'DEMO-BS-PHYS',
        name: 'Demo B.S. Physics',
      }),
    ],
  };
}
