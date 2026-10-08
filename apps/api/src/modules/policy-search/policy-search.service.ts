/**
 * @file Approved policy search: the session's tenant, the audience from the session's role, and
 * the injected clock decide which revisions apply; a deterministic keyword search ranks them.
 * Reused by the conversation tools.
 * @module @caa/api/modules/policy-search/policy-search.service
 * @requirement FR-16
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-02
 * @requirement AC42
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 6)
 */
import type { PolicySearchQuery, PolicySearchResponse } from '@caa/api-contract';
import type { PolicyDocumentRepository } from '@caa/db';
import { type Actor, PolicyAudience, Role } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import { type PolicyMatch, searchPolicies } from './policy-search.logic';

/** Dependencies of the policy search service. */
export interface PolicySearchServiceDependencies {
  readonly policyDocuments: Pick<PolicyDocumentRepository, 'listApplicable'>;
  /** Returns the current time; the instant revisions are judged at. */
  readonly now: () => Date;
}

/** Approved policy search. */
export interface PolicySearchService {
  /**
   * Finds the approved, currently effective policy documents that match the query, for the
   * actor's tenant and audience.
   *
   * @param actor - Authenticated actor from the session.
   * @param query - The validated text and topic.
   * @param context - Request-scoped values; the logger records counts, never the query or text.
   * @returns At most three hits and the instant they were judged at. May be empty.
   * @throws {Error} When the repository fails.
   */
  search(
    actor: Actor,
    query: PolicySearchQuery,
    context: RequestContext,
  ): Promise<PolicySearchResponse>;
}

/**
 * Chooses the audiences an actor may read.
 *
 * @param actor - Authenticated actor.
 * @returns `STUDENT` and `ALL`, plus `ADVISOR` for staff.
 */
function audiencesFor(actor: Actor): readonly PolicyAudience[] {
  // SECURITY: the audience comes from the session role, never from the request, so a student
  // can't read advisor-only text.
  const isStaff = actor.roles.includes(Role.Advisor) || actor.roles.includes(Role.Admin);
  return isStaff
    ? [PolicyAudience.Student, PolicyAudience.All, PolicyAudience.Advisor]
    : [PolicyAudience.Student, PolicyAudience.All];
}

/**
 * Maps a match to the contract hit, leaving out the body, tenant, subject, audience and hash.
 *
 * @param match - A match over an approved document.
 * @returns The hit.
 * @throws {Error} When the document has no approval time, which the repository never returns.
 */
function toHit(match: PolicyMatch): PolicySearchResponse['hits'][number] {
  const { document } = match;
  if (document.approvedAt === null) {
    throw new Error('A policy search returned a document that is not approved');
  }
  return {
    documentKey: document.documentKey,
    revision: document.revision,
    title: document.title,
    excerpt: match.excerpt,
    topic: document.topic,
    effectiveFrom: document.effectiveFrom,
    effectiveTo: document.effectiveTo,
    sourceLabel: document.sourceLabel,
    approvedAt: document.approvedAt,
    conflict: match.conflict,
  };
}

/**
 * Creates the policy search service.
 *
 * @param dependencies - Policy repository and clock.
 * @returns A {@link PolicySearchService}.
 */
export function createPolicySearchService(
  dependencies: PolicySearchServiceDependencies,
): PolicySearchService {
  const { policyDocuments, now } = dependencies;
  return {
    async search(actor, query, context) {
      const started = now().getTime();
      const asOf = now().toISOString();
      const documents = await policyDocuments.listApplicable({
        // SECURITY: tenant and audience come from the session only.
        tenantId: actor.tenantId,
        audiences: audiencesFor(actor),
        asOf,
      });
      const hits = searchPolicies(documents, query).map(toHit);
      // SECURITY: never log the query or any document text, only IDs and counts.
      context.logger.info(
        {
          tenantId: actor.tenantId,
          userId: actor.userId,
          hitCount: hits.length,
          durationMs: now().getTime() - started,
        },
        'policy search served',
      );
      return { hits, asOf };
    },
  };
}
