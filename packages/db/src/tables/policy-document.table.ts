/**
 * @file Table definition for approved policy documents (one row per revision).
 * @module @caa/db/tables/policy-document
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import type { PolicyApprovalStatus, PolicyAudience, PolicyTopic } from '@caa/domain';

import { institutionTable } from './institution.table';

/**
 * The `policy_document` table. An approved revision is immutable: a change is a new revision.
 * The database enforces this: migration `0019_policy_document_immutable` rejects UPDATE, DELETE
 * and TRUNCATE of an approved row (FR-16). Migration `0022_policy_document_withdrawal` allows
 * one change: retracting an approved row (APPROVED to WITHDRAWN, setting `withdrawn_at`).
 */
export const policyDocumentTable = pgTable(
  'policy_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    documentKey: text('document_key').notNull(),
    revision: integer('revision').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    topic: text('topic').notNull().$type<PolicyTopic>(),
    subjectKey: text('subject_key').notNull(),
    audience: text('audience').notNull().$type<PolicyAudience>(),
    /** Start of applicability, inclusive. */
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    /** End of applicability, exclusive, or null when open-ended. */
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    approvalStatus: text('approval_status').notNull().$type<PolicyApprovalStatus>(),
    /** Set once a revision is approved; kept on a retracted revision, null on a withdrawn draft. */
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    /** Set exactly when the status is WITHDRAWN: the instant the revision was retracted. */
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    sourceLabel: text('source_label').notNull(),
    contentHash: text('content_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // SECURITY: a document key and revision are unique within one tenant only.
    unique('policy_document_tenant_id_document_key_revision_key').on(
      table.tenantId,
      table.documentKey,
      table.revision,
    ),
    unique('policy_document_tenant_id_id_key').on(table.tenantId, table.id),
    check('policy_document_revision_positive', sql`${table.revision} >= 1`),
    check(
      'policy_document_text_fields_not_empty',
      sql`length(${table.documentKey}) > 0
      AND length(${table.title}) > 0 AND length(${table.body}) > 0
      AND length(${table.subjectKey}) > 0 AND length(${table.sourceLabel}) > 0`,
    ),
    check('policy_document_body_length', sql`length(${table.body}) <= 20000`),
    check(
      'policy_document_topic_valid',
      sql`${table.topic} IN ('GENERAL', 'FINANCIAL_AID', 'IMMIGRATION', 'ATHLETICS', 'ACCESSIBILITY', 'APPEALS', 'CRISIS')`,
    ),
    check(
      'policy_document_audience_valid',
      sql`${table.audience} IN ('STUDENT', 'ADVISOR', 'ALL')`,
    ),
    check(
      'policy_document_approval_status_valid',
      sql`${table.approvalStatus} IN ('DRAFT', 'APPROVED', 'WITHDRAWN')`,
    ),
    check(
      'policy_document_effective_range',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
    // SAFETY: a draft has no times, an approved row has only an approval time, and a withdrawn
    // row has a withdrawal time (and an approval time unless it was a withdrawn draft).
    check(
      'policy_document_times_match_status',
      sql`(${table.approvalStatus} = 'DRAFT' AND ${table.approvedAt} IS NULL AND ${table.withdrawnAt} IS NULL)
      OR (${table.approvalStatus} = 'APPROVED' AND ${table.approvedAt} IS NOT NULL AND ${table.withdrawnAt} IS NULL)
      OR (${table.approvalStatus} = 'WITHDRAWN' AND ${table.withdrawnAt} IS NOT NULL)`,
    ),
    check(
      'policy_document_content_hash_format',
      sql`${table.contentHash} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    index('policy_document_applicable_idx').on(
      table.tenantId,
      table.approvalStatus,
      table.documentKey,
      table.revision,
    ),
  ],
);

/** A row read from {@link policyDocumentTable}. Never leaves this package. */
export type PolicyDocumentRow = typeof policyDocumentTable.$inferSelect;
