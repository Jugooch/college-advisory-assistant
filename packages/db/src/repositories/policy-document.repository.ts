/**
 * @file Read-only data access for approved policy documents.
 * @module @caa/db/repositories/policy-document
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';

import type { InstitutionId, PolicyAudience, PolicyDocument } from '@caa/domain';

import type { Database } from '../client';
import { toPolicyDocument } from '../mappers/policy-document.mapper';
import { policyDocumentTable } from '../tables/policy-document.table';

/** Which documents {@link PolicyDocumentRepository.listApplicable} returns. */
export interface ApplicablePolicyQuery {
  /** Tenant that must own every document. Always required. */
  readonly tenantId: InstitutionId;
  /** Audiences the caller may read, for example `['STUDENT', 'ALL']`. */
  readonly audiences: readonly PolicyAudience[];
  /** Instant to evaluate at. ISO 8601 with offset; comes from an injected clock. */
  readonly asOf: string;
}

/** Reads approved policy documents. */
export interface PolicyDocumentRepository {
  /**
   * Lists the documents that apply to the audiences at the instant. For each document key the
   * current revision is chosen first: the highest revision that was ever approved
   * (`approvedAt` set, so a withdrawn draft never counts) with `effectiveFrom <= asOf`. It is
   * returned only when it is still approved (not retracted), `asOf < effectiveTo` (or
   * `effectiveTo` is null), and its audience is allowed. A retracted or expired current revision
   * returns nothing for its key; an older revision never applies again. A newer revision that
   * has not started yet is not current, so the older one still applies. Drafts never appear.
   *
   * @param query - Tenant, audiences, and instant.
   * @returns The applicable documents ordered by `documentKey`; empty when no audience is given.
   * @throws {RangeError} When `asOf` is not a valid date-time.
   */
  listApplicable(query: ApplicablePolicyQuery): Promise<readonly PolicyDocument[]>;
}

/**
 * Creates the policy document repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link PolicyDocumentRepository}.
 */
export function createPolicyDocumentRepository(db: Database): PolicyDocumentRepository {
  return {
    async listApplicable({ tenantId, audiences, asOf }) {
      const instant = new Date(asOf);
      if (Number.isNaN(instant.getTime())) {
        throw new RangeError('listApplicable requires a valid ISO 8601 instant');
      }
      if (audiences.length === 0) {
        return [];
      }
      const table = policyDocumentTable;
      const rows = await db
        .selectDistinctOn([table.documentKey])
        .from(table)
        .where(
          and(
            eq(table.tenantId, tenantId),
            // SAFETY: only revisions that were once approved can be current; a withdrawn draft
            // was never published, so it can't hide an older approved revision.
            isNotNull(table.approvedAt),
            // SAFETY: start is inclusive, so a revision becomes current exactly at effectiveFrom.
            lte(table.effectiveFrom, instant),
          ),
        )
        .orderBy(asc(table.documentKey), desc(table.revision));
      // SAFETY: the current revision is chosen above, before any other filter. Retraction,
      // expiry (end is exclusive) and audience apply to it afterwards, so none of them lets an
      // older revision through.
      const current = rows.filter(
        (row) =>
          row.approvalStatus === 'APPROVED' &&
          (row.effectiveTo === null || row.effectiveTo > instant),
      );
      return current.filter((row) => audiences.includes(row.audience)).map(toPolicyDocument);
    },
  };
}
