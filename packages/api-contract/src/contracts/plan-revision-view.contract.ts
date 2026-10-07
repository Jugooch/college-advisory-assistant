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
import { SchedulePinnedInputsSchema } from './schedule-pinned-inputs.contract';

/** Every pinned input a result and a revision both carry. */
const PINNED_INPUT_KEYS = SchedulePinnedInputsSchema.unwrap().keyof().options;

/** Keys of the stored revision fields, so the view's own fields aren't re-checked. */
const STORED_KEYS = Object.keys(PlanRevisionSchema.unwrap().shape);

/** Stands in for the dropped `createdBy` when the domain rules are re-run. Never returned. */
const PLACEHOLDER_USER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * The revision's stored fields plus its schedule-options result and its freshness. Every time
 * and state in it is "as of" `createdAt`; `freshness` says whether that still holds.
 */
export const PlanRevisionViewSchema = z
  .strictObject(PlanRevisionSchema.unwrap().shape)
  // SECURITY: `createdBy` is the student's user ID. Views show actors as a role plus `isYou`,
  // never a user ID (ADR-0013 §6), so the field is dropped and any value is rejected.
  .omit({ createdBy: true })
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
  // SAFETY: the stored fields still obey every rule of PlanRevisionSchema (distinct courses,
  // credit selections, selection vs outcome). The domain schema is re-run with a fixed
  // placeholder for the dropped `createdBy`, so those rules have one definition (ADR-0013 §2).
  .superRefine((revision, ctx) => {
    const stored = PlanRevisionSchema.safeParse({
      ...Object.fromEntries(STORED_KEYS.map((key) => [key, Reflect.get(revision, key)])),
      createdBy: PLACEHOLDER_USER_ID,
    });
    if (!stored.success) {
      for (const issue of stored.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  })
  // SAFETY: an unreadable result is always flagged and a readable one never is, so the UI
  // can't render a missing result as a pass (ADR-0013 §2).
  .refine((revision) => revision.resultUnavailable === (revision.result === null), {
    message: 'resultUnavailable must be true exactly when result is null',
    path: ['resultUnavailable'],
  })
  // SAFETY: the result shown is the one the revision was saved with, so its outcome and
  // courses must match the stored ones (ADR-0013 §2, NFR-01).
  .refine(
    (revision) =>
      revision.result === null ||
      (revision.result.outcome === revision.outcome &&
        revision.result.courseIds.length === revision.courseIds.length &&
        revision.result.courseIds.every(
          (courseId, index) => revision.courseIds[index] === courseId,
        )),
    { message: 'result outcome and courseIds must match the revision', path: ['result'] },
  )
  // SAFETY: every pinned input of the result equals the revision's, so a result from another
  // student record, audit, ruleset, sections, or transition table is never shown next to this
  // revision's freshness (ADR-0013 §2 and §3, NFR-01).
  .refine(
    (revision) =>
      revision.result === null ||
      PINNED_INPUT_KEYS.every((key) => revision.result?.pinnedInputs[key] === revision[key]),
    { message: 'result.pinnedInputs must match the revision pinned inputs', path: ['result'] },
  )
  // SAFETY: the chosen sections are exactly one option the result holds, so a schedule the
  // engine never produced is never shown as the plan (ADR-0013 §2 and §4).
  .refine(
    (revision) =>
      revision.result === null ||
      revision.selectedSectionIds === null ||
      revision.result.options.some(
        (option) =>
          option.bundles
            .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
            .sort()
            .join(',') === revision.selectedSectionIds?.join(','),
      ),
    {
      message: 'selectedSectionIds must be the sections of one result option',
      path: ['selectedSectionIds'],
    },
  )
  .readonly();

/** A saved plan revision as the API returns it. */
export type PlanRevisionView = z.infer<typeof PlanRevisionViewSchema>;
