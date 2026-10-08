/**
 * @file Converts policy document rows into domain objects.
 * @module @caa/db/mappers/policy-document
 * @requirement FR-16
 */
import { createPolicyDocument, type PolicyDocument } from '@caa/domain';

import type { PolicyDocumentRow } from '../tables/policy-document.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `policy_document` table.
 * @returns The domain policy document, with timestamps as ISO strings.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toPolicyDocument(row: PolicyDocumentRow): PolicyDocument {
  return createPolicyDocument({
    id: row.id,
    tenantId: row.tenantId,
    documentKey: row.documentKey,
    revision: row.revision,
    title: row.title,
    body: row.body,
    topic: row.topic,
    subjectKey: row.subjectKey,
    audience: row.audience,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo === null ? null : row.effectiveTo.toISOString(),
    approvalStatus: row.approvalStatus,
    approvedAt: row.approvedAt === null ? null : row.approvedAt.toISOString(),
    sourceLabel: row.sourceLabel,
    contentHash: row.contentHash,
  });
}
