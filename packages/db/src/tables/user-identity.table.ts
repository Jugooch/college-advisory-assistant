/**
 * @file Table definition for user identities (SSO principals within one institution).
 * @module @caa/db/tables/user-identity
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import type { IdentityStatus, Role } from '@caa/domain';

import { institutionTable } from './institution.table';

/** The `user_identity` table. Keyed globally by `issuer` + `subject`, never by email. */
export const userIdentityTable = pgTable(
  'user_identity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    /** Role values; the mapper re-validates them against `RoleSetSchema`. */
    roles: text('roles').array().notNull().$type<Role[]>(),
    status: text('status').notNull().$type<IdentityStatus>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('user_identity_issuer_subject_key').on(table.issuer, table.subject),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('user_identity_tenant_id_id_key').on(table.tenantId, table.id),
    check('user_identity_roles_not_empty', sql`cardinality(${table.roles}) > 0`),
  ],
);

/** A row read from {@link userIdentityTable}. Never leaves this package. */
export type UserIdentityRow = typeof userIdentityTable.$inferSelect;
