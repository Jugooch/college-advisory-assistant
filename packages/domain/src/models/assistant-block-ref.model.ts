/**
 * @file Assistant block references: what a stored assistant turn keeps of each block.
 * @module @caa/domain/models/assistant-block-ref
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { AssistantBlockKind } from '../enums/assistant-block-kind.enum';
import { CaseReasonSchema } from '../enums/case-reason.enum';
import { NoticeCodeSchema } from '../enums/notice-code.enum';
import { SpecialistTopicSchema } from '../enums/specialist-topic.enum';
import { PlanIdSchema } from './plan.model';
import { PlanRevisionIdSchema } from './plan-revision.model';
import { ScheduleConstraintSetSchema } from './schedule-constraint.model';

/** Most policy documents one block may cite. */
export const MAX_POLICY_REFS = 10;

/** Schema for a pointer to one policy revision. */
export const PolicyRevisionRefSchema = z
  .strictObject({
    documentKey: z.string().min(1).max(100),
    revision: z.number().int().min(1),
  })
  .readonly();

/** A pointer to one policy revision. */
export type PolicyRevisionRef = z.infer<typeof PolicyRevisionRefSchema>;

/** Fields a text block keeps: which approved template rendered it. */
const TEMPLATE_FIELDS = {
  templateId: z.string().min(1).max(100),
  templateVersion: z.string().min(1).max(50),
};

/**
 * Schema for a stored block reference. Each variant is strict and holds only IDs, template
 * identity, proposed constraints or a case reason, never a result payload (ADR-0015 §7). A
 * stored schedule or plan block is re-run or reopened, never replayed as current.
 */
export const AssistantBlockRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal(AssistantBlockKind.ScheduleOptions),
    /** When the options were shown. ISO 8601 with offset. */
    shownAt: z.iso.datetime({ offset: true }),
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.PlanEvidence),
    planId: PlanIdSchema,
    planRevisionId: PlanRevisionIdSchema,
    revision: z.number().int().min(1),
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.AcademicSummary),
    /** When the summary was shown. ISO 8601 with offset. */
    shownAt: z.iso.datetime({ offset: true }),
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.PolicyResults),
    documents: z.array(PolicyRevisionRefSchema).max(MAX_POLICY_REFS).readonly(),
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.ConstraintProposal),
    constraints: ScheduleConstraintSetSchema,
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.CasePreview),
    reason: CaseReasonSchema,
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.Notice),
    code: NoticeCodeSchema,
    ...TEMPLATE_FIELDS,
  }),
  z.strictObject({
    kind: z.literal(AssistantBlockKind.Referral),
    topic: SpecialistTopicSchema,
    ...TEMPLATE_FIELDS,
  }),
]);

/** A validated stored block reference. */
export type AssistantBlockRef = z.infer<typeof AssistantBlockRefSchema>;
