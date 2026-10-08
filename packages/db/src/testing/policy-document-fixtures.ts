/**
 * @file Synthetic policy document rows for integration tests. Test code only.
 * @module @caa/db/testing/policy-document-fixtures
 * @requirement FR-16
 */
import type { InstitutionId } from '@caa/domain';

import type { policyDocumentTable } from '../tables/policy-document.table';

/**
 * A well-formed synthetic content hash.
 */
export const POLICY_HASH = `sha256:${'b'.repeat(64)}`;

/**
 * A policy document row as it is inserted.
 */
export type NewPolicyDocument = typeof policyDocumentTable.$inferInsert;

/**
 * Builds an approved, open-ended student policy revision 1; overrides change any column.
 *
 * @param tenantId - Tenant that owns the row.
 * @param documentKey - Document key, also used for the title and subject.
 * @param overrides - Columns to change from the defaults.
 * @returns A row to insert.
 */
export function policyDocumentRow(
  tenantId: InstitutionId,
  documentKey: string,
  overrides: Partial<NewPolicyDocument> = {},
): NewPolicyDocument {
  return {
    tenantId,
    documentKey,
    revision: 1,
    title: `Title of ${documentKey}`,
    body: 'Fictional approved text.',
    topic: 'GENERAL',
    subjectKey: documentKey,
    audience: 'STUDENT',
    effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    effectiveTo: null,
    approvalStatus: 'APPROVED',
    approvedAt: new Date('2026-07-15T00:00:00.000Z'),
    sourceLabel: 'Fictional handbook',
    contentHash: POLICY_HASH,
    ...overrides,
  };
}
