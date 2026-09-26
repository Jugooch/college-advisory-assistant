/**
 * @file Builds synthetic advisor assignments for tests.
 * @module @caa/test-kit/builders/advisor-assignment
 */
import {
  type AdvisorAssignment,
  type AdvisorAssignmentInput,
  createAdvisorAssignment,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid, open-ended advisor assignment in tenant A.
 *
 * Defaults: advisor is user seed 2, student is student seed 1, approver is user seed 3, and
 * access starts 2026-08-17 with no end.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes assignments; drives the default `id`.
 * @returns A validated advisor assignment.
 */
export function buildAdvisorAssignment(
  overrides: Partial<AdvisorAssignmentInput> = {},
  seed = 1,
): AdvisorAssignment {
  return createAdvisorAssignment({
    id: syntheticId('assignment', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    advisorUserId: syntheticId('user', 2),
    studentId: syntheticId('student', 1),
    effectiveFrom: '2026-08-17T00:00:00.000-05:00',
    effectiveTo: null,
    approvedBy: syntheticId('user', 3),
    ...overrides,
  });
}
