/**
 * @file Request bodies for saving a plan draft and revalidating it.
 * @module @caa/api-contract/contracts/plan-drafts-request
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import { MAX_PLAN_SECTIONS, SectionIdSchema } from '@caa/domain';

import { ScheduleOptionsRequestSchema } from './schedule-options-request.contract';
import { SchedulePinnedInputsSchema } from './schedule-pinned-inputs.contract';

/**
 * Request body for `POST /v1/students/:studentId/plans`: save by replay (ADR-0013 §2).
 *
 * SECURITY: strict. The body names the schedule-options request, the chosen sections, and the
 * pinned inputs the client was shown. Tenant, user, role, and owner come from the session, so
 * any other field, such as `tenantId`, is rejected (ADR-0013 §5). The server replays the request
 * and never stores the client's result.
 */
export const SavePlanRequestSchema = z
  .strictObject({
    /** The request the student's options were computed from. */
    request: ScheduleOptionsRequestSchema,
    /**
     * The chosen sections, distinct; `null` when the saved outcome has no options. The server
     * rejects a set that isn't one of the replayed options (ADR-0013 §2).
     */
    selectedSectionIds: z
      .array(SectionIdSchema)
      .min(1)
      .max(MAX_PLAN_SECTIONS)
      .readonly()
      .nullable(),
    /** The pinned inputs as the client saw them; a replay that differs is 409 `REVISION_CONFLICT`. */
    expectedPinnedInputs: SchedulePinnedInputsSchema,
  })
  // SAFETY: two entries for one section would make the chosen set ambiguous
  // (ADR-0013 §2: the section set must match a replayed option exactly).
  .refine(
    (body) =>
      body.selectedSectionIds === null ||
      new Set(body.selectedSectionIds).size === body.selectedSectionIds.length,
    { message: 'selectedSectionIds must not repeat a section', path: ['selectedSectionIds'] },
  )
  .readonly();

/** Request body for `POST /v1/students/:studentId/plans`. */
export type SavePlanRequest = z.infer<typeof SavePlanRequestSchema>;

/**
 * Request body for `POST /v1/students/:studentId/plans/:planId/revalidate`.
 *
 * SECURITY: strict. Only the revision the client last saw; the inputs come from the stored
 * revision, and tenant, user, and role from the session (ADR-0013 §4, §5).
 */
export const RevalidatePlanRequestSchema = z
  .strictObject({
    /** The latest revision number the client saw; a different latest is 409 `REVISION_CONFLICT`. */
    expectedRevision: z.number().int().min(1),
  })
  .readonly();

/** Request body for `POST /v1/students/:studentId/plans/:planId/revalidate`. */
export type RevalidatePlanRequest = z.infer<typeof RevalidatePlanRequestSchema>;
