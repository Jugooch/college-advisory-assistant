/**
 * @file A saved plan revision as the API returns it: the stored fields, its result, and freshness.
 * @module @caa/api-contract/contracts/plan-revision-view
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import { PlanRevisionSchema } from '@caa/domain';

import { PlanFreshnessViewSchema } from './plan-freshness.contract';
import { ScheduleOptionsResponseSchema } from './schedule-options.contract';

/**
 * The revision's stored fields plus its schedule-options result and its freshness. Every time
 * and state in it is "as of" `createdAt`; `freshness` says whether that still holds.
 */
export const PlanRevisionViewSchema = PlanRevisionSchema.unwrap()
  .extend({
    /**
     * The stored result, or `null` when it no longer parses. It is never repaired or partly
     * shown (ADR-0013 §2).
     */
    result: ScheduleOptionsResponseSchema.nullable(),
    /** `true` exactly when `result` is `null`; the UI offers revalidation or an advisor. */
    resultUnavailable: z.boolean(),
    freshness: PlanFreshnessViewSchema,
  })
  // SAFETY: an unreadable result is always flagged and a readable one never is, so the UI
  // can't render a missing result as a pass (ADR-0013 §2).
  .refine((revision) => revision.resultUnavailable === (revision.result === null), {
    message: 'resultUnavailable must be true exactly when result is null',
    path: ['resultUnavailable'],
  })
  // SAFETY: the result shown is the one the revision was saved with, so its outcome and pinned
  // inputs must match the stored ones (ADR-0013 §2, NFR-01).
  .refine((revision) => revision.result === null || revision.result.outcome === revision.outcome, {
    message: 'result.outcome must match the revision outcome',
    path: ['result'],
  })
  .refine(
    (revision) =>
      revision.result === null ||
      (revision.result.pinnedInputs.constraintHash === revision.constraintHash &&
        revision.result.pinnedInputs.sectionSnapshotId === revision.sectionSnapshotId &&
        revision.result.pinnedInputs.rulesetVersion === revision.rulesetVersion),
    {
      message: 'result.pinnedInputs must match the revision pinned inputs',
      path: ['result'],
    },
  )
  .readonly();

/** A saved plan revision as the API returns it. */
export type PlanRevisionView = z.infer<typeof PlanRevisionViewSchema>;
