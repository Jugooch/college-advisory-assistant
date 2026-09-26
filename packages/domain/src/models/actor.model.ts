/**
 * @file Actor data object: the authenticated principal making a request.
 * @module @caa/domain/models/actor
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { RoleSetSchema, UserIdSchema } from './user-identity.model';

/**
 * Schema for the authenticated principal.
 *
 * SECURITY: an actor is created only on the server from a verified session. It is never parsed
 * from a request body, query, or header supplied by the client, and no contract schema embeds it.
 */
export const ActorSchema = z
  .object({
    userId: UserIdSchema,
    tenantId: InstitutionIdSchema,
    roles: RoleSetSchema,
  })
  .readonly();

/**
 * A validated, immutable authenticated principal.
 *
 * SECURITY: derive only from a server-side session, never from request input.
 */
export type Actor = z.infer<typeof ActorSchema>;

/** Raw input accepted by {@link createActor}. */
export type ActorInput = z.input<typeof ActorSchema>;

/**
 * Creates a validated, immutable actor from server-side session data.
 *
 * @param input - Fields read from the verified session. Never request input.
 * @returns The parsed actor.
 * @throws {z.ZodError} When a field is invalid, roles are empty, or roles contain duplicates.
 */
export function createActor(input: ActorInput): Actor {
  return ActorSchema.parse(input);
}
