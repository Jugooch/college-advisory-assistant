/**
 * @file Case-draft preview for the assistant: checks the draft against the case rules and
 * builds the preview block and the model projection. A preview creates nothing. Pure.
 * @module @caa/api/modules/conversation-tool-case-preview/conversation-tool-case-preview.logic
 * @requirement FR-14
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4)
 */
import type { AssistantBlock } from '@caa/api-contract';
import {
  AdvisingCaseSchema,
  AssistantBlockKind,
  type CaseReason,
  CaseStatus,
  DiscrepancySubject,
  type PlanId,
} from '@caa/domain';

import type { JsonValue } from '../conversation-tools/conversation-tools.logic';

/** The queue every drafted case goes to. */
export const CASE_QUEUE_LABEL = 'advisors assigned to you';

/** The plan a case preview names, or `null` for a source discrepancy without one. */
export interface PreviewPlan {
  readonly planId: PlanId;
  readonly revision: number;
}

/** Placeholder identifiers: the preview checks the case shape only, and no case is created. */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Checks a case draft against the same schema a real case must satisfy.
 *
 * @param reason - The case reason.
 * @param planId - The plan the model named, if any.
 * @param subject - The discrepancy subject the model named, if any.
 * @returns True when the combination can form a case preview.
 */
export function isValidCaseDraft(
  reason: CaseReason,
  planId: PlanId | undefined,
  subject: DiscrepancySubject | undefined,
): boolean {
  // SAFETY: the case schema owns the plan and subject rules; reusing it keeps the preview from
  // offering a draft the case flow would reject.
  return AdvisingCaseSchema.safeParse({
    id: PLACEHOLDER_ID,
    tenantId: PLACEHOLDER_ID,
    studentId: PLACEHOLDER_ID,
    reason,
    planRevisionId: planId === undefined ? null : PLACEHOLDER_ID,
    discrepancySubject: subject ?? null,
    studentNote: 'preview',
    status: CaseStatus.Open,
    ownerUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSequence: 1,
  }).success;
}

/**
 * Whether a case with this reason must name a plan. Derived from the case schema: no plan is
 * needed when some subject choice lets a plan-less draft pass.
 *
 * @param reason - The case reason.
 * @returns True when a draft without a plan would be rejected.
 */
export function reasonNeedsPlan(reason: CaseReason): boolean {
  const subjects: readonly (DiscrepancySubject | undefined)[] = [
    undefined,
    ...Object.values(DiscrepancySubject),
  ];
  return !subjects.some((subject) => isValidCaseDraft(reason, undefined, subject));
}

/**
 * Checks a draft's reason and subject alone, as if a plan were attached when the reason needs
 * one. Lets a malformed draft fail before any plan lookup.
 *
 * @param reason - The case reason.
 * @param subject - The discrepancy subject the model named, if any.
 * @returns True when a plan could complete the draft.
 */
export function isValidCaseShape(
  reason: CaseReason,
  subject: DiscrepancySubject | undefined,
): boolean {
  // SAFETY: a stand-in plan id; the shape check never reads or stores it.
  const stand = reasonNeedsPlan(reason) ? (PLACEHOLDER_ID as PlanId) : undefined;
  return isValidCaseDraft(reason, stand, subject);
}

/** A saved plan as far as selection needs it. */
export interface PlanChoice {
  readonly id: PlanId;
  readonly termId: string;
  readonly latestRevision: number;
}

/**
 * Picks the student's current plan: the first listed (newest first) in the planner's term, or
 * the first listed when no term is confirmed.
 *
 * @param plans - The student's plans, newest first.
 * @param termId - The planner form's term, if any.
 * @returns The current plan as a preview plan, or `null` when none matches.
 */
export function pickCurrentPlan(
  plans: readonly PlanChoice[],
  termId: string | undefined,
): PreviewPlan | null {
  const current = plans.find((summary) => termId === undefined || summary.termId === termId);
  return current === undefined ? null : { planId: current.id, revision: current.latestRevision };
}

/**
 * Builds the case preview block. The note is always empty: the model writes none.
 *
 * @param reason - The case reason.
 * @param plan - The plan revision to freeze, or `null`.
 * @param subject - The disputed subject for a discrepancy, or `undefined`.
 * @returns A preview block that creates nothing.
 */
export function buildCasePreviewBlock(
  reason: CaseReason,
  plan: PreviewPlan | null,
  subject: DiscrepancySubject | undefined,
): AssistantBlock {
  return {
    kind: AssistantBlockKind.CasePreview,
    reason,
    planId: plan?.planId ?? null,
    planRevision: plan?.revision ?? null,
    discrepancySubject: subject ?? null,
    suggestedNote: '',
    queueLabel: CASE_QUEUE_LABEL,
  };
}

/**
 * Minimizes a case preview to its reason and whether it names a plan.
 *
 * @param reason - The case reason.
 * @param hasPlan - Whether a plan revision is attached.
 * @returns The model projection.
 */
export function projectCasePreview(reason: CaseReason, hasPlan: boolean): JsonValue {
  return { reason, hasPlan, submitted: false };
}
