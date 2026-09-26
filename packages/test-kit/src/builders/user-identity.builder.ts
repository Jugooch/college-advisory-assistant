/**
 * @file Builds synthetic user identities for tests.
 * @module @caa/test-kit/builders/user-identity
 */
import {
  createUserIdentity,
  IdentityStatus,
  Role,
  type UserIdentity,
  type UserIdentityInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid user identity, defaulting to an active student in tenant A.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes identities; drives the default `id` and `subject`.
 * @returns A validated user identity.
 */
export function buildUserIdentity(
  overrides: Partial<UserIdentityInput> = {},
  seed = 1,
): UserIdentity {
  return createUserIdentity({
    id: syntheticId('user', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    issuer: 'https://idp.synthetic.example',
    subject: `synthetic-subject-${String(seed)}`,
    roles: [Role.Student],
    status: IdentityStatus.Active,
    ...overrides,
  });
}
