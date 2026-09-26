/**
 * @file The two fixed synthetic tenants every test uses. Both institutions are fictional.
 * @module @caa/test-kit/fixtures/synthetic-tenants
 * @see docs/standards/07-testing.md
 */
import { createInstitution, type Institution } from '@caa/domain';

import { syntheticId } from './synthetic-id';

/**
 * Fixed synthetic tenants with deterministic IDs. Builders default to tenant `a`; use tenant `b`
 * for cross-tenant isolation tests.
 *
 * - `a`: Demo State University, `10000000-0000-4000-8000-000000000001`.
 * - `b`: Sample Community College, `10000000-0000-4000-8000-000000000002`.
 */
export const SYNTHETIC_TENANTS: Readonly<{ a: Institution; b: Institution }> = {
  a: createInstitution({
    id: syntheticId('tenant', 1),
    name: 'Demo State University',
    timezone: 'America/Chicago',
    createdAt: '2026-01-05T09:00:00.000-06:00',
  }),
  b: createInstitution({
    id: syntheticId('tenant', 2),
    name: 'Sample Community College',
    timezone: 'America/Denver',
    createdAt: '2026-01-12T09:00:00.000-07:00',
  }),
};
