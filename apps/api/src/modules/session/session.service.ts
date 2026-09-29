/**
 * @file Resolves a bearer token to the authenticated actor, and describes the session for
 * `GET /v1/me`. SSO plugs in behind the same resolver interface.
 * @module @caa/api/modules/session/session.service
 * @requirement FR-01
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import type { StudentUserLinkRepository, UserIdentityRepository } from '@caa/db';
import { type Actor, createActor, IdentityStatus, Role, type StudentId } from '@caa/domain';

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

/** The signed-in user as `GET /v1/me` shows them. */
export interface SessionView {
  readonly userId: Actor['userId'];
  readonly tenantId: Actor['tenantId'];
  readonly roles: Actor['roles'];
  /** The student record linked to a student session, or `null` for any other session. */
  readonly studentId: StudentId | null;
}

/** Dependencies of the session service. */
export interface SessionServiceDependencies {
  /** Finds the student a signed-in user is linked to, in that user's tenant. */
  readonly studentUserLinks: StudentUserLinkRepository;
}

/** Describes the authenticated session. */
export interface SessionService {
  /**
   * Describes the session, with the student record a student is linked to.
   *
   * @param actor - Authenticated actor from the session.
   * @returns The actor's identity and roles, and their linked student ID or `null`.
   * @throws {Error} When the user is linked to more than one student; no student is chosen.
   */
  describe(actor: Actor): Promise<SessionView>;
}

/**
 * Creates the session service.
 *
 * @param dependencies - The student link repository.
 * @returns A {@link SessionService}.
 */
export function createSessionService(dependencies: SessionServiceDependencies): SessionService {
  return {
    async describe(actor) {
      const { userId, tenantId, roles } = actor;
      // SECURITY: the link is looked up only for a student session, for the session's own user
      // in the session's tenant; nothing comes from the request (FR-01). Advisors and admins
      // reach students through the access rule, never through /v1/me.
      const linked = roles.includes(Role.Student)
        ? await dependencies.studentUserLinks.findByUserId(tenantId, userId)
        : null;
      // SECURITY: a link from another tenant is never shown, even if a repository returns one.
      const studentId = linked !== null && linked.tenantId === tenantId ? linked.id : null;
      return { userId, tenantId, roles, studentId };
    },
  };
}
