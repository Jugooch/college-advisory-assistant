/**
 * @file Contract for approved policy search.
 * @module @caa/api-contract/contracts/policies
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 6 and 10)
 */
import { z } from 'zod';

import { PolicyDocumentSchema, PolicyTopicSchema } from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';

/** Field schemas of the domain policy document, reused so the contract can't drift from it. */
const PolicyFields = PolicyDocumentSchema.unwrap().shape;

/** Most hits one search returns (ADR-0015 section 6). */
export const MAX_POLICY_HITS = 3;

/**
 * Query for `GET /v1/policies`.
 *
 * SECURITY: strict, and it has no tenant, user, role or audience key. The server takes all of
 * those from the session (ADR-0015 section 6). At least one of `q` and `topic` is required; `topic`
 * alone lists the approved documents on that topic, such as a referral document.
 */
export const PolicySearchQuerySchema = z
  .strictObject({
    q: z.string().trim().min(1).max(200).optional(),
    topic: PolicyTopicSchema.optional(),
  })
  // SAFETY: a search with no text and no topic would match everything, so it is refused
  // (ADR-0015 §6).
  .refine((query) => query.q !== undefined || query.topic !== undefined, {
    message: 'q or topic is required',
    path: ['q'],
  })
  .readonly();

/** Query for `GET /v1/policies`. */
export type PolicySearchQuery = z.infer<typeof PolicySearchQuerySchema>;

/**
 * One approved policy revision found by a search, with the excerpt that matched.
 *
 * SECURITY: data minimization and strict. The full body, `tenantId`, `subjectKey`, `audience`,
 * `contentHash` and approval status stay on the server. Only approved revisions are ever hits,
 * so `approvedAt` is never null. `conflict` is true when another returned hit shares its subject
 * and the two may disagree (ADR-0015 section 6). Reused by the conversation `POLICY_RESULTS` block.
 */
export const PolicyHitSchema = z
  .strictObject({
    documentKey: PolicyFields.documentKey,
    revision: PolicyFields.revision,
    title: PolicyFields.title,
    excerpt: z.string().min(1).max(500),
    topic: PolicyFields.topic,
    effectiveFrom: PolicyFields.effectiveFrom,
    effectiveTo: PolicyFields.effectiveTo,
    sourceLabel: PolicyFields.sourceLabel,
    approvedAt: z.iso.datetime({ offset: true }),
    conflict: z.boolean(),
  })
  // SAFETY: an interval that is empty or reversed would never apply, or apply wrongly
  // (ADR-0015 §6, AC42).
  // NOTE: compared as instants, because strings with different offsets don't sort lexically.
  .refine(
    (hit) =>
      hit.effectiveTo === null || Date.parse(hit.effectiveTo) > Date.parse(hit.effectiveFrom),
    { message: 'effectiveTo must be later than effectiveFrom', path: ['effectiveTo'] },
  )
  .readonly();

/** One approved policy search hit. */
export type PolicyHit = z.infer<typeof PolicyHitSchema>;

/**
 * Response body for `GET /v1/policies`.
 *
 * `asOf` is the instant at which the server judged which revisions applied. An empty list is a
 * valid answer: the UI then says nothing approved matched and offers an advisor referral.
 */
export const PolicySearchResponseSchema = z
  .strictObject({
    hits: z.array(PolicyHitSchema).max(MAX_POLICY_HITS).readonly(),
    asOf: z.iso.datetime({ offset: true }),
  })
  // SAFETY: the search returns one revision per document, so a repeated key would show a
  // superseded revision next to the current one (ADR-0015 §6, AC42).
  .refine((body) => new Set(body.hits.map((hit) => hit.documentKey)).size === body.hits.length, {
    message: 'hits must not repeat a document key',
    path: ['hits'],
  })
  // SAFETY: an expired or not-yet-effective revision must never show as current policy. A hit
  // applies when effectiveFrom <= asOf < effectiveTo (null = open), compared as instants
  // (ADR-0015 §6, AC42).
  .refine(
    (body) => {
      const asOf = Date.parse(body.asOf);
      return body.hits.every(
        (hit) =>
          Date.parse(hit.effectiveFrom) <= asOf &&
          (hit.effectiveTo === null || asOf < Date.parse(hit.effectiveTo)),
      );
    },
    { message: 'every hit must apply at asOf', path: ['hits'] },
  )
  .readonly();

/** Response body for `GET /v1/policies`. */
export type PolicySearchResponse = z.infer<typeof PolicySearchResponseSchema>;

/**
 * Searches approved policy documents for the session's tenant and audience. Query:
 * `PolicySearchQuerySchema`. Errors: 400 for a query that fails the schema.
 */
export const searchPoliciesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/policies',
  query: PolicySearchQuerySchema,
  response: PolicySearchResponseSchema,
});
