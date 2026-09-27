/**
 * @file Resolves a bearer token to the authenticated actor. SSO plugs in behind the same interface.
 * @module @caa/api/modules/session/session.service
 * @requirement FR-01
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import type { UserIdentityRepository } from '@caa/db';
import { type Actor, createActor, IdentityStatus } from '@caa/domain';

/** Turns a bearer token into the actor it belongs to. */
export interface SessionResolver {
  /**
   * Resolves the actor for a bearer token.
   *
   * @param bearerToken - Token from the `Authorization` header. Never logged.
   * @returns The actor, or null when the token is unknown or its identity may not sign in.
   */
  resolve(bearerToken: string): Promise<Actor | null>;
}

/** SSO identity that a dev token stands for. */
export interface DevTokenIdentity {
  readonly issuer: string;
  readonly subject: string;
}

/** Dependencies of the dev session resolver. */
export interface DevSessionResolverDependencies {
  /** Opaque dev token to the synthetic identity it signs in as. */
  readonly tokens: Readonly<Record<string, DevTokenIdentity>>;
  readonly identities: UserIdentityRepository;
}

/**
 * Creates the resolver used when `AUTH_MODE=dev`: opaque tokens map to seeded synthetic identities.
 *
 * @param dependencies - Token map and identity repository.
 * @returns A {@link SessionResolver}.
 */
export function createDevSessionResolver(
  dependencies: DevSessionResolverDependencies,
): SessionResolver {
  // SECURITY: a Map, not the record, so tokens like `__proto__` or `constructor` can't match
  // inherited object properties.
  const tokens = new Map(Object.entries(dependencies.tokens));
  return {
    async resolve(bearerToken) {
      const mapped = tokens.get(bearerToken);
      if (mapped === undefined) {
        return null;
      }
      const identity = await dependencies.identities.findByIssuerSubject(
        mapped.issuer,
        mapped.subject,
      );
      // SECURITY: a disabled identity is denied even though its token is known.
      if (identity?.status !== IdentityStatus.Active) {
        return null;
      }
      // SECURITY: tenant, user, and roles come only from the stored identity.
      return createActor({
        userId: identity.id,
        tenantId: identity.tenantId,
        roles: identity.roles,
      });
    },
  };
}

/**
 * Creates the resolver used when no sign-in method is configured. It denies every token.
 *
 * @returns A {@link SessionResolver} that always resolves to null.
 */
export function createDenyAllSessionResolver(): SessionResolver {
  return {
    resolve: () => Promise.resolve(null),
  };
}
