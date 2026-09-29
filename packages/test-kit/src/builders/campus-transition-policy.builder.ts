/**
 * @file Builds synthetic campus transition policies: the minutes needed between two campuses.
 * @module @caa/test-kit/builders/campus-transition-policy
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusTransition,
  type CampusTransitionPolicy,
  type CampusTransitionPolicyInput,
  CampusTransitionSchema,
  createCampusTransitionPolicy,
} from '@caa/domain';

import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds one validated ordered campus pair. Every argument is required, so a test never gets a
 * travel time it didn't state.
 *
 * @param fromCampusId - Campus of the meeting that ends first.
 * @param toCampusId - Campus of the meeting that starts next; must be a different campus.
 * @param minutes - Whole minutes the institution requires between the two meetings.
 * @returns A validated campus transition.
 * @throws {z.ZodError} When the campuses are the same or the minutes aren't a whole,
 *   non-negative number.
 */
export function buildCampusTransition(
  fromCampusId: string,
  toCampusId: string,
  minutes: number,
): CampusTransition {
  return CampusTransitionSchema.parse({ fromCampusId, toCampusId, minutes });
}

/**
 * Builds a valid campus transition table of tenant A, version `demo-2026.1`, that lists **no
 * pairs**. That is the conservative default: every pair of different campuses is unknown, so
 * the engine reports an option that needs one as UNKNOWN (`TRANSITION_TIME_UNDEFINED`), never
 * as feasible (AC08). Add pairs with {@link buildCampusTransition}.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated campus transition policy.
 */
export function buildCampusTransitionPolicy(
  overrides: Partial<CampusTransitionPolicyInput> = {},
): CampusTransitionPolicy {
  return createCampusTransitionPolicy({
    tenantId: SYNTHETIC_TENANTS.a.id,
    version: 'demo-2026.1',
    transitions: [],
    ...overrides,
  });
}
