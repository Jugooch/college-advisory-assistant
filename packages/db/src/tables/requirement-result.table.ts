/**
 * @file Table definition for requirement results of an audit snapshot.
 * @module @caa/db/tables/requirement-result
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { RequirementState } from '@caa/domain';

import { auditSnapshotTable } from './audit-snapshot.table';
import { institutionTable } from './institution.table';

/**
 * The `requirement_result` table. One row per requirement of one audit snapshot, written with
 * the audit and never changed. The parent link stays inside the same audit.
 */
export const requirementResultTable = pgTable(
  'requirement_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    auditSnapshotId: uuid('audit_snapshot_id').notNull(),
    /** Zero-based position in the audit's requirement order. */
    position: integer('position').notNull(),
    sourceRequirementId: text('source_requirement_id').notNull(),
    /** Parent's `source_requirement_id` in the same audit, or null for a top-level one. */
    parentSourceRequirementId: text('parent_source_requirement_id'),
    label: text('label').notNull(),
    state: text('state').notNull().$type<RequirementState>(),
    // NOTE: ID arrays keep the audit's own order; the mapper validates each element.
    allocatedAttemptIds: uuid('allocated_attempt_ids').array().notNull(),
    /** Credits still needed in hundredths, or null when not measured in credits. */
    remainingCreditsHundredths: integer('remaining_credits_hundredths'),
    /** Courses still needed, or null when not measured in courses. */
    remainingCourseCount: integer('remaining_course_count'),
    candidateCourseIds: uuid('candidate_course_ids').array().notNull(),
    isReusable: boolean('is_reusable').notNull(),
    sourceRef: text('source_ref').notNull(),
  },
  (table) => [
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('requirement_result_tenant_id_id_key').on(table.tenantId, table.id),
    unique('requirement_result_source_requirement_key').on(
      table.tenantId,
      table.auditSnapshotId,
      table.sourceRequirementId,
    ),
    unique('requirement_result_position_key').on(
      table.tenantId,
      table.auditSnapshotId,
      table.position,
    ),
    foreignKey({
      name: 'requirement_result_audit_snapshot_fk',
      columns: [table.tenantId, table.auditSnapshotId],
      foreignColumns: [auditSnapshotTable.tenantId, auditSnapshotTable.id],
    }),
    // SAFETY: a parent must be a requirement of the same audit. Cycles can't be expressed as a
    // key, so the mapper rejects them through `AuditSnapshotSchema`.
    foreignKey({
      name: 'requirement_result_parent_fk',
      columns: [table.tenantId, table.auditSnapshotId, table.parentSourceRequirementId],
      foreignColumns: [table.tenantId, table.auditSnapshotId, table.sourceRequirementId],
    }),
    check(
      'requirement_result_not_own_parent',
      sql`${table.parentSourceRequirementId} IS NULL
        OR ${table.parentSourceRequirementId} <> ${table.sourceRequirementId}`,
    ),
    check('requirement_result_position_nonnegative', sql`${table.position} >= 0`),
    check(
      'requirement_result_text_not_empty',
      sql`length(${table.sourceRequirementId}) > 0 AND length(${table.label}) > 0
        AND length(${table.sourceRef}) > 0`,
    ),
    check(
      'requirement_result_remaining_nonnegative',
      sql`coalesce(${table.remainingCreditsHundredths}, 0) >= 0
        AND coalesce(${table.remainingCourseCount}, 0) >= 0`,
    ),
    // SAFETY: mirrors `RequirementResultSchema`: a COMPLETE requirement has nothing remaining.
    check(
      'requirement_result_complete_has_no_remainder',
      sql`${table.state} <> 'COMPLETE'
        OR (coalesce(${table.remainingCreditsHundredths}, 0) = 0
          AND coalesce(${table.remainingCourseCount}, 0) = 0)`,
    ),
  ],
);

/** A row read from {@link requirementResultTable}. Never leaves this package. */
export type RequirementResultRow = typeof requirementResultTable.$inferSelect;
