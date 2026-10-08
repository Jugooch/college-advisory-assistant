/**
 * @file Table definition for case events: the append-only history of an advising case.
 * @module @caa/db/tables/case-event
 * @requirement FR-12
 * @requirement FR-14
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { CaseAction, CaseResolution, CaseStatus, Role } from '@caa/domain';

import { advisingCaseTable } from './advising-case.table';
import { institutionTable } from './institution.table';
import { userIdentityTable } from './user-identity.table';

/**
 * The `case_event` table. Append-only: a database trigger refuses UPDATE, DELETE and TRUNCATE
 * (migration 0014), so a case's history is never rewritten.
 */
export const caseEventTable = pgTable(
  'case_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    caseId: uuid('case_id').notNull(),
    sequence: integer('sequence').notNull(),
    action: text('action').notNull().$type<CaseAction>(),
    actorUserId: uuid('actor_user_id').notNull(),
    // SAFETY: required (migration 0017); a missing role is a constraint error, never a guess.
    actorRole: text('actor_role').notNull().$type<Role>(),
    at: timestamp('at', { withTimezone: true, precision: 3 }).notNull(),
    fromStatus: text('from_status').$type<CaseStatus>(),
    toStatus: text('to_status').notNull().$type<CaseStatus>(),
    resolution: text('resolution').$type<CaseResolution>(),
    // SECURITY: never logged and never in an error message.
    note: text('note'),
  },
  (table) => [
    // SAFETY: turns a lost append race into a conflict (ADR-0011, ADR-0013 §6).
    unique('case_event_case_id_sequence_key').on(table.caseId, table.sequence),
    // SECURITY: the case and the actor must be this tenant's.
    foreignKey({
      name: 'case_event_case_fk',
      columns: [table.tenantId, table.caseId],
      foreignColumns: [advisingCaseTable.tenantId, advisingCaseTable.id],
    }),
    foreignKey({
      name: 'case_event_actor_fk',
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [userIdentityTable.tenantId, userIdentityTable.id],
    }),
    check(
      'case_event_actor_role_valid',
      sql`${table.actorRole} IN ('STUDENT', 'ADVISOR', 'ADMIN')`,
    ),
    check(
      'case_event_shape',
      sql`${table.sequence} >= 1
        AND ${table.action} IN ('CREATE', 'CLAIM', 'RELEASE', 'RESOLVE', 'WITHDRAW')
        AND ${table.toStatus} IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN')
        AND (${table.fromStatus} IS NULL OR ${table.fromStatus} IN
          ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN'))
        AND (${table.action} = 'CREATE') = (${table.fromStatus} IS NULL)
        AND (${table.action} = 'CREATE') = (${table.sequence} = 1)
        AND (${table.action} = 'RESOLVE') = (${table.resolution} IS NOT NULL)
        AND (${table.resolution} IS NULL OR ${table.resolution} IN
          ('PLAN_REVIEWED', 'STUDENT_ACTION_NEEDED', 'REFERRED_OUTSIDE_APP'))
        AND (${table.note} IS NULL OR (${table.action} = 'RESOLVE'
          AND char_length(btrim(${table.note})) BETWEEN 1 AND 1000))`,
    ),
  ],
);

/** A row read from {@link caseEventTable}. Never leaves this package. */
export type CaseEventRow = typeof caseEventTable.$inferSelect;
