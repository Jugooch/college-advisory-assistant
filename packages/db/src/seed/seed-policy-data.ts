/**
 * @file Writes the policy corpus seed. Insert-only and idempotent, because an approved
 *   revision is immutable.
 * @module @caa/db/seed/seed-policy-data
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { PolicyDocument } from '@caa/domain';

import type { Database } from '../client';
import { policyDocumentTable } from '../tables/policy-document.table';

/** The part of a database handle or transaction the seed writes through. */
type SeedWriter = Pick<Database, 'insert'>;

/**
 * Inserts each document, leaving an existing revision as it is.
 *
 * @param db - Database handle or transaction.
 * @param documents - Synthetic policy documents.
 * @returns How many documents the plan holds.
 */
export async function insertPolicyDocuments(
  db: SeedWriter,
  documents: readonly PolicyDocument[],
): Promise<number> {
  for (const document of documents) {
    await db
      .insert(policyDocumentTable)
      .values({
        ...document,
        effectiveFrom: new Date(document.effectiveFrom),
        effectiveTo: document.effectiveTo === null ? null : new Date(document.effectiveTo),
        approvedAt: document.approvedAt === null ? null : new Date(document.approvedAt),
        // NOTE: the domain object has no withdrawal time; a seeded withdrawn revision is
        // treated as withdrawn from its start, which keeps the seed deterministic.
        withdrawnAt:
          document.approvalStatus === 'WITHDRAWN' ? new Date(document.effectiveFrom) : null,
      })
      // NOTE: nothing is updated; a changed document is a new revision.
      .onConflictDoNothing();
  }
  return documents.length;
}
