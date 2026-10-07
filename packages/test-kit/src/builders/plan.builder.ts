/**
 * @file Builds synthetic plans for tests.
 * @module @caa/test-kit/builders/plan
 */
import { createPlan, type Plan, type PlanInput } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_SCHEDULE_TERM } from '../fixtures/synthetic-schedule-term';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid plan for student 1 in tenant A for the synthetic schedule term.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes plans; drives the default `id`.
 * @returns A validated plan.
 */
export function buildPlan(overrides: Partial<PlanInput> = {}, seed = 1): Plan {
  return createPlan({
    id: syntheticId('plan', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    termId: SYNTHETIC_SCHEDULE_TERM.termId,
    createdAt: '2026-09-21T09:00:00.000-05:00',
    ...overrides,
  });
}
