/**
 * @file Converts user identity rows into domain objects.
 * @module @caa/db/mappers/user-identity
 * @requirement FR-02
 */
import { createUserIdentity, type UserIdentity } from '@caa/domain';

import type { UserIdentityRow } from '../tables/user-identity.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `user_identity` table.
 * @returns The domain user identity.
 * @throws {z.ZodError} When the stored row violates the domain schema, for example empty or
 *   duplicate roles.
 */
export function toUserIdentity(row: UserIdentityRow): UserIdentity {
  return createUserIdentity({
    id: row.id,
    tenantId: row.tenantId,
    issuer: row.issuer,
    subject: row.subject,
    roles: row.roles,
    status: row.status,
  });
}
