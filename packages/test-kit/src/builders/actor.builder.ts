/**
 * @file Builds synthetic authenticated actors for tests.
 * @module @caa/test-kit/builders/actor
 */
import { type Actor, type ActorInput, createActor, Role } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid actor, defaulting to a student in tenant A. With the same seed, the actor's
 * `userId` matches the `id` from `buildUserIdentity`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes actors; drives the default `userId`.
 * @returns A validated actor.
 */
export function buildActor(overrides: Partial<ActorInput> = {}, seed = 1): Actor {
  return createActor({
    userId: syntheticId('user', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    roles: [Role.Student],
    ...overrides,
  });
}
