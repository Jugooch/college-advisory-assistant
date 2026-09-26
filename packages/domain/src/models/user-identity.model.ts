/**
 * @file User identity data object: an SSO principal within one institution.
 * @module @caa/domain/models/user-identity
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { IdentityStatusSchema } from '../enums/identity-status.enum';
import { RoleSchema } from '../enums/role.enum';
import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a user ID can never be passed where another ID is expected. */
export const UserIdSchema = z.uuid().brand<'UserId'>();

/** Unique identifier of a {@link UserIdentity}. */
export type UserId = z.infer<typeof UserIdSchema>;

/** Schema for a non-empty set of roles with no duplicates. */
export const RoleSetSchema = z
  .array(RoleSchema)
  // SECURITY: a principal with no role must never reach an authorization check as "anyone".
  .min(1)
  // SECURITY: duplicates hide mistakes in role mapping and make role lists ambiguous to compare.
  .refine((roles) => new Set(roles).size === roles.length, {
    message: 'Roles must not contain duplicates',
  })
  .readonly();

/** A validated, immutable, non-empty set of roles. */
export type RoleSet = z.infer<typeof RoleSetSchema>;

/**
 * Schema for a user identity.
 *
 * An identity is keyed by `issuer` + `subject` from the SSO provider, never by email.
 */
export const UserIdentitySchema = z
  .object({
    id: UserIdSchema,
    tenantId: InstitutionIdSchema,
    /** SSO issuer, for example the identity provider's entity ID or `iss` claim. */
    issuer: z.string().min(1),
    /** Stable subject identifier from the issuer (`sub` claim). Never an email address. */
    subject: z.string().min(1),
    roles: RoleSetSchema,
    status: IdentityStatusSchema,
  })
  .readonly();

/** A validated, immutable user identity. */
export type UserIdentity = z.infer<typeof UserIdentitySchema>;

/** Raw input accepted by {@link createUserIdentity}. */
export type UserIdentityInput = z.input<typeof UserIdentitySchema>;

/**
 * Creates a validated, immutable user identity.
 *
 * @param input - Raw identity fields.
 * @returns The parsed user identity.
 * @throws {z.ZodError} When a field is invalid, roles are empty, or roles contain duplicates.
 */
export function createUserIdentity(input: UserIdentityInput): UserIdentity {
  return UserIdentitySchema.parse(input);
}
