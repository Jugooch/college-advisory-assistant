/**
 * @file QA-owned in-memory approved policy document repository for the API acceptance harness.
 * It follows the documented `@caa/db` contract (tenant filter, approved only, start inclusive
 * and end exclusive, the highest revision of each key chosen before the audience filter),
 * written here from that contract and not copied from anyone's fakes, so the acceptance oracle
 * stays independent of the code under test.
 * @module @caa/tests/support/policy-repositories
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/standards/07-testing.md
 */
import type { PolicyDocumentRepository } from '@caa/db';
import { PolicyApprovalStatus, type PolicyDocument } from '@caa/domain';

/** Policy backing data. A field that is omitted means nothing of that kind is stored. */
export interface PolicyDocumentWorld {
  /** Policy document revisions of every tenant, in any status. */
  policyDocuments?: readonly PolicyDocument[];
}

/** The policy repository the harness gives the API's `Repositories` under `policyDocuments`. */
export interface PolicyRepositories {
  readonly policyDocuments: PolicyDocumentRepository;
}

/**
 * Tells whether a revision is approved and in force at the instant. Start is inclusive, end
 * exclusive.
 *
 * @param document - The revision.
 * @param at - Instant in epoch milliseconds.
 * @returns True when approved and in force.
 */
function isInForce(document: PolicyDocument, at: number): boolean {
  return (
    document.approvalStatus === PolicyApprovalStatus.Approved &&
    Date.parse(document.effectiveFrom) <= at &&
    (document.effectiveTo === null || at < Date.parse(document.effectiveTo))
  );
}

/**
 * Creates the policy repositories over the world. Every call reads the world again.
 *
 * @param world - Backing data.
 * @returns The repositories to spread into the harness's `Repositories`.
 */
export function createPolicyRepositories(world: PolicyDocumentWorld): PolicyRepositories {
  return {
    policyDocuments: {
      listApplicable: ({ tenantId, audiences, asOf }) => {
        const at = Date.parse(asOf);
        if (Number.isNaN(at)) {
          return Promise.reject(new RangeError('listApplicable requires a valid ISO 8601 instant'));
        }
        const current = new Map<string, PolicyDocument>();
        for (const document of world.policyDocuments ?? []) {
          const best = current.get(document.documentKey);
          if (
            document.tenantId === tenantId &&
            isInForce(document, at) &&
            (best === undefined || document.revision > best.revision)
          ) {
            current.set(document.documentKey, document);
          }
        }
        // The audience applies to the chosen revision only; an older, broader one never returns.
        const applicable = [...current.values()]
          .filter((document) => audiences.includes(document.audience))
          .sort((left, right) => left.documentKey.localeCompare(right.documentKey));
        return Promise.resolve(applicable);
      },
    },
  };
}
