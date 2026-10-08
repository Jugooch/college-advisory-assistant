/**
 * @file In-memory fake of the policy document repository for API tests, with the same tenant
 * filter, approved-only rule, start-inclusive end-exclusive window, highest-revision choice
 * before the audience filter as PostgreSQL. Test code only; never wired by the container.
 * @module @caa/api/testing/in-memory-policy-repositories
 * @see docs/standards/07-testing.md
 */
import type { PolicyDocumentRepository } from '@caa/db';
import { PolicyApprovalStatus, type PolicyDocument } from '@caa/domain';

/** Policy backing data. Omitted means none stored. */
export interface InMemoryPolicyStore {
  /** Every revision of every document of every tenant, in any status. */
  policyDocuments?: readonly PolicyDocument[];
}

/**
 * Creates the policy repository over the store. Every call reads the store again.
 *
 * @param store - Backing data.
 * @returns A {@link PolicyDocumentRepository}.
 */
export function createInMemoryPolicyRepository(
  store: InMemoryPolicyStore,
): PolicyDocumentRepository {
  return {
    listApplicable: ({ tenantId, audiences, asOf }) => {
      const at = Date.parse(asOf);
      const current = new Map<string, PolicyDocument>();
      for (const document of store.policyDocuments ?? []) {
        const best = current.get(document.documentKey);
        const isInForce =
          document.tenantId === tenantId &&
          document.approvalStatus === PolicyApprovalStatus.Approved &&
          Date.parse(document.effectiveFrom) <= at &&
          (document.effectiveTo === null || at < Date.parse(document.effectiveTo));
        if (isInForce && (best === undefined || document.revision > best.revision)) {
          current.set(document.documentKey, document);
        }
      }
      return Promise.resolve(
        [...current.values()]
          .filter((document) => audiences.includes(document.audience))
          .sort((left, right) => (left.documentKey < right.documentKey ? -1 : 1)),
      );
    },
  };
}
