/**
 * @file Builds synthetic stored assistant block references for tests.
 * @module @caa/test-kit/builders/assistant-block-ref
 */
import type { z } from 'zod';

import {
  AssistantBlockKind,
  type AssistantBlockRef,
  AssistantBlockRefSchema,
  CaseReason,
  NoticeCode,
  SpecialistTopic,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';

/** Raw input accepted for a block reference, as the domain schema reads it. */
export type AssistantBlockRefInput = z.input<typeof AssistantBlockRefSchema>;

/**
 * Builds a valid `POLICY_RESULTS` block reference citing `late-registration` revision 1.
 *
 * @param input - A complete block reference of any kind, replacing the default.
 * @returns A validated block reference.
 */
export function buildAssistantBlockRef(input?: AssistantBlockRefInput): AssistantBlockRef {
  return AssistantBlockRefSchema.parse(
    input ?? {
      kind: AssistantBlockKind.PolicyResults,
      documents: [{ documentKey: 'late-registration', revision: 1 }],
    },
  );
}

/**
 * Builds one valid block reference of each kind; the constraint proposal has no constraints.
 *
 * @returns Eight block references, one per {@link AssistantBlockKind}, in enum order.
 */
export function buildAssistantBlockRefOfEveryKind(): readonly AssistantBlockRef[] {
  const shownAt = '2026-09-22T10:00:05.000-05:00';
  return [
    buildAssistantBlockRef({ kind: AssistantBlockKind.ScheduleOptions, shownAt }),
    buildAssistantBlockRef({
      kind: AssistantBlockKind.PlanEvidence,
      planId: syntheticId('plan', 1),
      planRevisionId: syntheticId('planRevision', 1),
      revision: 1,
    }),
    buildAssistantBlockRef({ kind: AssistantBlockKind.AcademicSummary, shownAt }),
    buildAssistantBlockRef(),
    buildAssistantBlockRef({ kind: AssistantBlockKind.ConstraintProposal, constraints: [] }),
    buildAssistantBlockRef({ kind: AssistantBlockKind.CasePreview, reason: CaseReason.PlanReview }),
    buildAssistantBlockRef({
      kind: AssistantBlockKind.Notice,
      code: NoticeCode.OverrideProcess,
      templateId: 'notice-override-process',
      templateVersion: '1',
    }),
    buildAssistantBlockRef({
      kind: AssistantBlockKind.Referral,
      topic: SpecialistTopic.FinancialAid,
      templateId: 'referral-financial-aid',
      templateVersion: '1',
    }),
  ];
}
