/**
 * @file Contract for listing the terms a student can plan for.
 * @module @caa/api-contract/contracts/plannable-terms
 * @requirement FR-08
 * @requirement NFR-04
 * @see docs/adr/0010-schedule-options-endpoint.md
 */
import { z } from 'zod';

import { TermSchema } from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';

/** Field schemas of the domain term, reused so the contract can't drift from it. */
const TermFields = TermSchema.unwrap().shape;

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * One term the planner can offer: ID, code and calendar dates.
 *
 * SECURITY: data minimization. `tenantId` and `sequence` stay on the server; they are stripped.
 * It carries no freshness marker or snapshot ID: every listed term is plannable by definition
 * (ADR-0010 Amendment 6, ADR-0008 Amendment 1).
 */
export const PlannableTermSchema = z
  .object({
    id: TermFields.id,
    termCode: TermFields.termCode,
    startsOn: TermFields.startsOn,
    endsOn: TermFields.endsOn,
  })
  // SAFETY: same rule as TermSchema; a term that ends before it starts has no valid dates.
  .refine((term) => term.startsOn <= term.endsOn, {
    message: 'startsOn must not be later than endsOn',
    path: ['endsOn'],
  })
  .readonly();

/** One plannable term. */
export type PlannableTerm = z.infer<typeof PlannableTermSchema>;

/**
 * Response body for `GET /v1/students/:studentId/plannable-terms`.
 *
 * The list is in the tenant's term order, which the server applies. An empty list is a valid
 * answer: the UI then shows an advisor referral instead of a picker.
 */
export const PlannableTermsResponseSchema = z
  .object({
    terms: z.array(PlannableTermSchema).readonly(),
  })
  // SAFETY: a repeated term would offer the same term twice, so identity must be unique.
  .refine((body) => isDistinct(body.terms.map((term) => term.id)), {
    message: 'terms must not repeat a term id',
    path: ['terms'],
  })
  .refine((body) => isDistinct(body.terms.map((term) => term.termCode)), {
    message: 'terms must not repeat a term code',
    path: ['terms'],
  })
  .readonly();

/** Response body for `GET /v1/students/:studentId/plannable-terms`. */
export type PlannableTermsResponse = z.infer<typeof PlannableTermsResponseSchema>;

/** Lists the terms whose latest published snapshot would pass the schedule-options gate now. */
export const getPlannableTermsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/plannable-terms',
  response: PlannableTermsResponseSchema,
});
