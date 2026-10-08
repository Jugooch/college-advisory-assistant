/**
 * @file Builds synthetic academic summary responses for tests.
 * @module @caa/test-kit/builders/academic-summary-response
 */
import type { z } from 'zod';

import { type AcademicSummaryResponse, AcademicSummaryResponseSchema } from '@caa/api-contract';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { syntheticId, syntheticSourceStudentId } from '../fixtures/synthetic-id';

/** Raw input accepted for an academic summary, as the contract schema reads it. */
export type AcademicSummaryResponseInput = z.input<typeof AcademicSummaryResponseSchema>;

/**
 * Builds a valid summary for student seed 1: program seed 1, catalog `2025-2026`, an audit
 * generated 2026-09-20 08:00 that reflects the record (PASS), a matching program and catalog
 * (PASS), and one incomplete requirement, `Mathematics core`.
 *
 * @param overrides - Fields to replace in the default. A summary without an audit must also set
 *   `auditReflectsRecord`, `programCatalogConsistency` to `null` and `requirements` to `[]`.
 * @returns The summary, parsed by the contract.
 */
export function buildAcademicSummaryResponse(
  overrides: Partial<AcademicSummaryResponseInput> = {},
): AcademicSummaryResponse {
  return AcademicSummaryResponseSchema.parse({
    student: {
      id: syntheticId('student', 1),
      sourceStudentId: syntheticSourceStudentId(1),
    },
    studentSnapshot: {
      id: syntheticId('studentSnapshot', 1),
      programId: syntheticId('program', 1),
      catalogYear: '2025-2026',
      sourceEffectiveAt: '2026-09-20T07:30:00.000-05:00',
      programName: 'BS Mathematics',
    },
    audit: {
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r1',
      programId: syntheticId('program', 1),
      catalogYear: '2025-2026',
      programName: 'BS Mathematics',
      generatedAt: '2026-09-20T08:00:00.000-05:00',
      studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    },
    auditReflectsRecord: { state: 'PASS', reasonCode: null },
    programCatalogConsistency: { state: 'PASS', reasonCode: null },
    courses: [],
    requirements: [
      {
        sourceRequirementId: 'REQ-001',
        parentSourceRequirementId: null,
        label: 'Mathematics core',
        state: 'INCOMPLETE',
        remainingCreditsHundredths: 300,
        remainingCourseCount: 1,
        candidateCourseIds: [SYNTHETIC_COURSES.math102.id],
        sourceRef: 'demo-audit/REQ-001',
      },
    ],
    ...overrides,
  });
}
