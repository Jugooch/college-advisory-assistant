/**
 * @file Builds synthetic campuses for tests.
 * @module @caa/test-kit/builders/campus
 * @see packages/test-kit/src/fixtures/synthetic-campuses.ts
 */
import { type Campus, type CampusInput, createCampus } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid campus of tenant A. The default source ID is `DEMO-CAMPUS-` and the name is
 * `Demo Campus ` plus the seed padded to three digits, for example `DEMO-CAMPUS-001`.
 *
 * Seeds 1 and 2 are the IDs of `SYNTHETIC_CAMPUSES.north` and `.south`. To refer to those, use
 * the fixture; for another campus, use seed 3 or higher.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes campuses; drives the default `id`, `sourceCampusId` and `name`.
 * @returns A validated campus.
 */
export function buildCampus(overrides: Partial<CampusInput> = {}, seed = 1): Campus {
  const number = String(seed).padStart(3, '0');
  return createCampus({
    id: syntheticId('campus', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceCampusId: `DEMO-CAMPUS-${number}`,
    name: `Demo Campus ${number}`,
    ...overrides,
  });
}
