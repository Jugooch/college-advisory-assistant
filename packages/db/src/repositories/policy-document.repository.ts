/**
 * @file Read-only data access for approved policy documents.
 * @module @caa/db/repositories/policy-document
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

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
   * Lists the documents that apply to the audiences at the instant: approved only, with
   * `effectiveFrom <= asOf` and (`effectiveTo` is null or `asOf < effectiveTo`), and only the
   * highest such revision of each document key. That revision is chosen first; the audience
   * filter is applied to it afterwards, so a key whose current revision is for another audience
   * returns nothing rather than an older revision. Draft and withdrawn revisions never appear.
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
            // SAFETY: only approved text is ever searchable; drafts and withdrawn never leave.
            eq(table.approvalStatus, 'APPROVED'),
            // SAFETY: start is inclusive and end is exclusive, so a document ends exactly at effectiveTo.
            lte(table.effectiveFrom, instant),
            or(isNull(table.effectiveTo), gt(table.effectiveTo, instant)),
          ),
        )
        .orderBy(asc(table.documentKey), desc(table.revision));
      // SAFETY: audience is applied only after the current revision is chosen, so a revision
      // narrowed to another audience never lets an older, broader revision through.
      return rows.filter((row) => audiences.includes(row.audience)).map(toPolicyDocument);
    },
  };
}
