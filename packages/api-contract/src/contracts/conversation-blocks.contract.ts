/**
 * @file Assistant blocks: the verified views one assistant turn can carry.
 * @module @caa/api-contract/contracts/conversation-blocks
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 3, 4 and 7)
 */
import { z } from 'zod';

import {
  AssistantBlockKind,
  CaseReason,
  CaseReasonSchema,
  DiscrepancySubjectSchema,
  MAX_SCHEDULE_CONSTRAINTS,
  NoticeCodeSchema,
  PlanIdSchema,
  ScheduleConstraintSchema,
  ScheduleConstraintSetSchema,
  SpecialistTopicSchema,
  STUDENT_NOTE_MAX_LENGTH,
} from '@caa/domain';

import { AcademicSummaryResponseSchema } from './academic-summary.contract';
import { PlanRevisionViewSchema } from './plan-revision-view.contract';
import { PolicyHitSchema, PolicySearchResponseSchema } from './policies.contract';
import { ScheduleOptionsResponseSchema } from './schedule-options.contract';

/** Longest fixed template text of a notice or referral block, in characters. */
export const BLOCK_TEMPLATE_TEXT_MAX_LENGTH = 1000;

/**
 * Template identity and rendered text of a notice or referral. The text comes from an approved
 * template, never from the model (ADR-0015 §3). The ID and version bounds match the stored
 * block reference in the domain package.
 */
const TEMPLATE_FIELDS = {
  templateId: z.string().min(1).max(100),
  templateVersion: z.string().min(1).max(50),
  text: z.string().min(1).max(BLOCK_TEMPLATE_TEXT_MAX_LENGTH),
};

/**
 * One constraint the assistant proposes. `confirmed` is always `false`: a proposal reaches the
 * solver only after the student confirms it in the planner form (ADR-0015 §4).
 */
export const ProposedConstraintSchema = z
  .strictObject({
    constraint: ScheduleConstraintSchema,
    confirmed: z.literal(false),
  })
  .readonly();

/** One proposed, unconfirmed schedule constraint. */
export type ProposedConstraint = z.infer<typeof ProposedConstraintSchema>;

/**
 * Block that shows a drafted case for the student to review. It creates nothing; the student
 * submits through the case flow (ADR-0015 §4).
 */
const CasePreviewBlockSchema = z
  .strictObject({
    kind: z.literal(AssistantBlockKind.CasePreview),
    reason: CaseReasonSchema,
    /** The plan to freeze into the case, or `null` for a source discrepancy. */
    planId: PlanIdSchema.nullable(),
    /** The revision of that plan, or `null` exactly when `planId` is. */
    planRevision: z.number().int().min(1).nullable(),
    /** What is disputed. Set exactly for a source discrepancy, otherwise `null`. */
    discrepancySubject: DiscrepancySubjectSchema.nullable(),
    /** Suggested note the student can edit. Empty when the output guard rejected the text. */
    suggestedNote: z.string().max(STUDENT_NOTE_MAX_LENGTH),
    /** Who receives the case, for example "advisors assigned to you". */
    queueLabel: z.string().min(1).max(100),
  })
  // SAFETY: a plan review without a plan is unreviewable, and a plan ID without its revision
  // names nothing to freeze (ADR-0015 §4, ADR-0013 §6, FR-12).
  .refine(
    (block) =>
      (block.planId === null) === (block.planRevision === null) &&
      (block.reason === CaseReason.SourceDiscrepancy || block.planId !== null),
    {
      message: 'planId and planRevision are set together unless SOURCE_DISCREPANCY',
      path: ['planId'],
    },
  )
  // SAFETY: a subject on another reason, or none on a discrepancy, would misroute the report
  // (ADR-0015 §4, ADR-0013 §6, FR-17).
  .refine(
    (block) =>
      (block.reason === CaseReason.SourceDiscrepancy) === (block.discrepancySubject !== null),
    {
      message: 'discrepancySubject is present exactly when the reason is SOURCE_DISCREPANCY',
      path: ['discrepancySubject'],
    },
  )
  .readonly();

/**
 * Schema for a live block, discriminated by `kind`. Data blocks reuse the existing verified
 * schemas, so each renders from structured, validated fields and never from model text
 * (ADR-0015 §3, AC43).
 */
export const AssistantBlockSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.ScheduleOptions),
      result: ScheduleOptionsResponseSchema,
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.PlanEvidence),
      /** The revision with its read-time freshness (ADR-0013 §3). */
      plan: PlanRevisionViewSchema,
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.AcademicSummary),
      summary: AcademicSummaryResponseSchema,
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.PolicyResults),
      /** Hits with the `asOf` instant they were judged at, under the policy search rules. */
      results: PolicySearchResponseSchema,
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.ConstraintProposal),
      constraints: z
        .array(ProposedConstraintSchema)
        .min(1)
        .max(MAX_SCHEDULE_CONSTRAINTS)
        .readonly(),
    })
    // SAFETY: the proposed set must obey every rule of a request's constraint set, such as
    // distinct ranks, so a confirmed chip can never produce a rejected request (ADR-0015 §4).
    .superRefine((block, ctx) => {
      const set = ScheduleConstraintSetSchema.safeParse(
        block.constraints.map((proposed) => proposed.constraint),
      );
      if (!set.success) {
        for (const issue of set.error.issues) {
          ctx.addIssue({ code: 'custom', message: issue.message, path: ['constraints'] });
        }
      }
    })
    .readonly(),
  CasePreviewBlockSchema,
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.Notice),
      code: NoticeCodeSchema,
      ...TEMPLATE_FIELDS,
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal(AssistantBlockKind.Referral),
      topic: SpecialistTopicSchema,
      ...TEMPLATE_FIELDS,
      /** The approved referral document the text points to, or `null` when none applies. */
      policy: PolicyHitSchema.nullable(),
    })
    .readonly(),
]);

/** A validated live assistant block. */
export type AssistantBlock = z.infer<typeof AssistantBlockSchema>;
