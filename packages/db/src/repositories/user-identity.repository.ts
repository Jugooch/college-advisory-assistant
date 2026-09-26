/**
 * @file Data access for user identities.
 * @module @caa/db/repositories/user-identity
 * @requirement FR-01
 * @requirement FR-02
 */
import { and, eq } from 'drizzle-orm';

import type { UserIdentity } from '@caa/domain';

import type { Database } from '../client';
import { toUserIdentity } from '../mappers/user-identity.mapper';
import { userIdentityTable } from '../tables/user-identity.table';

/** Reads user identities. */
export interface UserIdentityRepository {
  /**
   * Finds the identity an SSO issuer vouched for. Disabled identities are returned too, so the
   * caller can deny them explicitly.
   *
   * @param issuer - SSO issuer from the verified token.
   * @param subject - Subject from the verified token.
   * @returns The identity, including its tenant, or null when none exists.
   */
  findByIssuerSubject(issuer: string, subject: string): Promise<UserIdentity | null>;
}

/**
 * Creates the user identity repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link UserIdentityRepository}.
 */
export function createUserIdentityRepository(db: Database): UserIdentityRepository {
  return {
    async findByIssuerSubject(issuer, subject) {
      // SECURITY: this is the one lookup that isn't filtered by tenant, because it is how the
      // tenant is resolved in the first place. It is safe because issuer + subject is globally
      // unique (`user_identity_issuer_subject_key`), both values come from a verified token rather
      // than user input, and the result carries its own tenantId, which becomes the session's
      // tenant for every later, tenant-filtered query.
      const rows = await db
        .select()
        .from(userIdentityTable)
        .where(and(eq(userIdentityTable.issuer, issuer), eq(userIdentityTable.subject, subject)))
        .limit(1);
      const row = rows[0];
      return row ? toUserIdentity(row) : null;
    },
  };
}
