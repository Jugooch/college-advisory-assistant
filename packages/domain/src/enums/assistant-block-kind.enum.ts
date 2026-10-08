/**
 * @file The kind of verified block an assistant turn can carry.
 * @module @caa/domain/enums/assistant-block-kind
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** The kind of verified block an assistant turn can carry. */
export const AssistantBlockKind = {
  ScheduleOptions: 'SCHEDULE_OPTIONS',
  PlanEvidence: 'PLAN_EVIDENCE',
  AcademicSummary: 'ACADEMIC_SUMMARY',
  PolicyResults: 'POLICY_RESULTS',
  ConstraintProposal: 'CONSTRAINT_PROPOSAL',
  CasePreview: 'CASE_PREVIEW',
  Notice: 'NOTICE',
  Referral: 'REFERRAL',
} as const;

/** Union of every {@link AssistantBlockKind} value. */
export type AssistantBlockKind = (typeof AssistantBlockKind)[keyof typeof AssistantBlockKind];

/** Runtime schema for {@link AssistantBlockKind}. */
export const AssistantBlockKindSchema = z.enum(AssistantBlockKind);
