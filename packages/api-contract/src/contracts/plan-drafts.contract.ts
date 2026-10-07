/**
 * @file Contracts for plan drafts: save, list, read, read a revision, and revalidate. A plan is
 *   one per student per term, and its revisions are append-only.
 * @module @caa/api-contract/contracts/plan-drafts
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  PlanIdSchema,
  PlanRevisionCauseSchema,
  ScheduleOutcomeSchema,
  TermIdSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { PlanFreshnessViewSchema } from './plan-freshness.contract';
import { PlanRevisionViewSchema } from './plan-revision-view.contract';

/** One entry of a plan's revision index. */
export const PlanRevisionIndexEntrySchema = z
  .strictObject({
    revision: z.number().int().min(1),
    cause: PlanRevisionCauseSchema,
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/** Status of an advisor case that is still open (ADR-0013 §6). */
export const OpenCaseStatusSchema = z.enum(['OPEN', 'IN_REVIEW']);

/**
 * Response body for the save and revalidate endpoints and for `GET .../plans/:planId`: the
 * latest revision in full and the index of every revision.
 */
export const PlanViewSchema = z
  .strictObject({
    id: PlanIdSchema,
    termId: TermIdSchema,
    /** When the plan was first saved. ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    /** The latest revision, with its own freshness. */
    latest: PlanRevisionViewSchema,
    /** Every revision, oldest first, numbered 1 to n. */
    revisions: z.array(PlanRevisionIndexEntrySchema).min(1).readonly(),
  })
  // SAFETY: the index lists revisions 1 to n in order and ends at the revision shown in full,
  // so history is never reordered or shown with a gap (ADR-0013 §1).
  .refine(
    (plan) =>
      plan.revisions.every((entry, index) => entry.revision === index + 1) &&
      plan.revisions.length === plan.latest.revision,
    { message: 'revisions must run 1 to n and end at the latest revision', path: ['revisions'] },
  )
  // SAFETY: the revision shown belongs to this plan and the index agrees with it
  // (ADR-0013 §1: revisions are immutable).
  .refine(
    (plan) =>
      plan.latest.planId === plan.id &&
      plan.latest.termId === plan.termId &&
      plan.revisions.at(-1)?.cause === plan.latest.cause &&
      plan.revisions.at(-1)?.createdAt === plan.latest.createdAt,
    { message: 'latest must be the last indexed revision of this plan', path: ['latest'] },
  )
  .readonly();

/** A plan with its latest revision. */
export type PlanView = z.infer<typeof PlanViewSchema>;

/** One plan in the list: its term and its latest revision, in brief. */
export const PlanSummarySchema = z
  .strictObject({
    id: PlanIdSchema,
    termId: TermIdSchema,
    /** Number of the latest revision. */
    latestRevision: z.number().int().min(1),
    /** When the latest revision was created. ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    outcome: ScheduleOutcomeSchema,
    /** Freshness of the latest revision. */
    freshness: PlanFreshnessViewSchema,
    /** Status of the plan's open advisor case, or `null` when it has none. */
    openCaseStatus: OpenCaseStatusSchema.nullable(),
  })
  .readonly();

/** One plan in the list. */
export type PlanSummary = z.infer<typeof PlanSummarySchema>;

/** Response body for `GET /v1/students/:studentId/plans`: one entry per plan, one per term. */
export const PlanListResponseSchema = z
  .strictObject({
    plans: z.array(PlanSummarySchema).readonly(),
  })
  // SAFETY: one plan per student per term (ADR-0013 §1), so a repeated term or plan is a defect.
  .refine(
    (body) =>
      new Set(body.plans.map((plan) => plan.termId)).size === body.plans.length &&
      new Set(body.plans.map((plan) => plan.id)).size === body.plans.length,
    { message: 'plans must not repeat a plan or a term', path: ['plans'] },
  )
  .readonly();

/** Response body for `GET /v1/students/:studentId/plans`. */
export type PlanListResponse = z.infer<typeof PlanListResponseSchema>;

/**
 * Saves a plan revision for the student's own record by replaying schedule options (ADR-0013
 * §2). Body: {@link SavePlanRequestSchema}. 201 returns the plan view. Errors: 400 for a bad
 * body or a section set that isn't a replayed option; 404 when not found or not permitted,
 * an assigned advisor included; 409 `REVISION_CONFLICT` when the replayed pinned inputs differ;
 * 409 `STALE_SOURCE` when a source is stale; 503 `SOURCE_UNAVAILABLE`. Nothing is written on
 * an error. Read-only toward institutional systems: it registers nothing.
 */
export const savePlanEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/plans',
  response: PlanViewSchema,
});

/**
 * Lists the student's plans for anyone allowed to view the student. Errors: 404 when not found
 * or not permitted.
 */
export const listPlansEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/plans',
  response: PlanListResponseSchema,
});

/**
 * Reads a plan with its latest revision in full. A stale or unknown revision is still returned
 * as history, with its freshness (ADR-0013 §3). Errors: 404 when not found or not permitted;
 * 503 `SOURCE_UNAVAILABLE` only when the plan itself can't be read.
 */
export const getPlanEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/plans/:planId',
  response: PlanViewSchema,
});

/**
 * Reads one historical revision. Its `freshness` is about that revision. Errors: 404 when the
 * plan or revision isn't found or isn't permitted; 503 `SOURCE_UNAVAILABLE` only when the
 * revision itself can't be read.
 */
export const getPlanRevisionEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/plans/:planId/revisions/:revision',
  response: PlanRevisionViewSchema,
});

/**
 * Replays the latest revision's stored inputs on the current sources and appends a
 * `REVALIDATED` revision (ADR-0013 §4). Body: `RevalidatePlanRequestSchema`. 201 returns the
 * new plan view. Errors: 400 for a bad body; 404 when not found or not permitted, an assigned
 * advisor included; 409 `REVISION_CONFLICT` when `expectedRevision` isn't the latest; 409
 * `STALE_SOURCE` when a source is stale; 503 `SOURCE_UNAVAILABLE`. Nothing is written on an
 * error.
 */
export const revalidatePlanEndpoint = defineEndpoint({
  method: 'POST',
  path: '/v1/students/:studentId/plans/:planId/revalidate',
  response: PlanViewSchema,
});
