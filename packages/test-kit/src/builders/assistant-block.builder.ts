/**
 * @file Builds one synthetic live assistant block of each kind for tests.
 * @module @caa/test-kit/builders/assistant-block
 */
import {
  type AssistantBlock,
  AssistantBlockSchema,
  type ProposedConstraint,
  ProposedConstraintSchema,
} from '@caa/api-contract';
import {
  AssistantBlockKind,
  CaseReason,
  NoticeCode,
  PolicyTopic,
  SpecialistTopic,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { buildAcademicSummaryResponse } from './academic-summary-response.builder';
import { buildPlanRevisionView } from './plan-revision-view.builder';
import { POLICY_CORPUS_AS_OF } from './policy-corpus.builder';
import { buildPolicyHit } from './policy-hit.builder';
import { buildUnavailableTime } from './schedule-constraint.builder';
import { buildScheduleOptionsResponse } from './schedule-options-response.builder';

/** Raw input of the block of kind `K`, as the contract schema reads it. */
type BlockInput<K extends AssistantBlockKind> = Omit<Extract<AssistantBlock, { kind: K }>, 'kind'>;

/**
 * Parses a draft block with the contract, so a builder never returns an invalid block.
 *
 * @param draft - The block as the schema reads it.
 * @returns The validated block.
 */
function parseBlock(draft: unknown): AssistantBlock {
  return AssistantBlockSchema.parse(draft);
}

/**
 * Builds a proposed constraint: "no Fridays", PREFERRED at rank 1, unconfirmed.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated proposed constraint.
 */
export function buildProposedConstraint(
  overrides: Partial<ProposedConstraint> = {},
): ProposedConstraint {
  return ProposedConstraintSchema.parse({
    constraint: buildUnavailableTime(),
    confirmed: false,
    ...overrides,
  });
}

/**
 * Builds a `SCHEDULE_OPTIONS` block holding the default one-option response.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildScheduleOptionsBlock(
  overrides: Partial<BlockInput<'SCHEDULE_OPTIONS'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.ScheduleOptions,
    result: buildScheduleOptionsResponse(),
    ...overrides,
  });
}

/**
 * Builds a `PLAN_EVIDENCE` block holding the default current plan revision view.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildPlanEvidenceBlock(
  overrides: Partial<BlockInput<'PLAN_EVIDENCE'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.PlanEvidence,
    plan: buildPlanRevisionView(),
    ...overrides,
  });
}

/**
 * Builds an `ACADEMIC_SUMMARY` block holding the default summary.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildAcademicSummaryBlock(
  overrides: Partial<BlockInput<'ACADEMIC_SUMMARY'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.AcademicSummary,
    summary: buildAcademicSummaryResponse(),
    ...overrides,
  });
}

/**
 * Builds a `POLICY_RESULTS` block with the default hit, judged at the corpus `asOf`
 * (2026-09-22 10:00 -05:00). A hit must apply at `asOf`.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildPolicyResultsBlock(
  overrides: Partial<BlockInput<'POLICY_RESULTS'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.PolicyResults,
    results: { hits: [buildPolicyHit()], asOf: POLICY_CORPUS_AS_OF },
    ...overrides,
  });
}

/**
 * Builds a `CONSTRAINT_PROPOSAL` block with one unconfirmed, PREFERRED "no Fridays" proposal.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildConstraintProposalBlock(
  overrides: Partial<BlockInput<'CONSTRAINT_PROPOSAL'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.ConstraintProposal,
    constraints: [buildProposedConstraint()],
    ...overrides,
  });
}

/**
 * Builds a `CASE_PREVIEW` block for a plan review of plan seed 1, revision 1, with a short
 * suggested note.
 *
 * @param overrides - Fields to replace in the default. A source discrepancy needs
 *   `planId`/`planRevision` null and a `discrepancySubject`.
 * @returns A validated block.
 */
export function buildCasePreviewBlock(
  overrides: Partial<BlockInput<'CASE_PREVIEW'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.CasePreview,
    reason: CaseReason.PlanReview,
    planId: syntheticId('plan', 1),
    planRevision: 1,
    discrepancySubject: null,
    suggestedNote: 'Please review my saved plan for next term.',
    queueLabel: 'Advisors assigned to you',
    ...overrides,
  });
}

/**
 * Builds a `NOTICE` block for a rate-limited turn with fixed template text.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated block.
 */
export function buildNoticeBlock(overrides: Partial<BlockInput<'NOTICE'>> = {}): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.Notice,
    code: NoticeCode.RateLimited,
    templateId: 'notice-rate-limited',
    templateVersion: '1',
    text: 'You have sent many messages. Please wait a moment and try again.',
    ...overrides,
  });
}

/**
 * Builds a `REFERRAL` block for financial aid with the matching approved policy hit, judged at
 * the corpus `asOf`. The policy topic must equal the block topic and apply at `asOf`.
 *
 * @param overrides - Fields to replace in the default. Change `topic` together with `policy`.
 * @returns A validated block.
 */
export function buildReferralBlock(
  overrides: Partial<BlockInput<'REFERRAL'>> = {},
): AssistantBlock {
  return parseBlock({
    kind: AssistantBlockKind.Referral,
    topic: SpecialistTopic.FinancialAid,
    templateId: 'referral-financial-aid',
    templateVersion: '1',
    text: 'Financial aid questions go to the financial aid office.',
    policy: buildPolicyHit({
      documentKey: 'financial-aid-referral',
      title: 'Financial aid referral',
      topic: PolicyTopic.FinancialAid,
    }),
    asOf: POLICY_CORPUS_AS_OF,
    ...overrides,
  });
}

/**
 * Builds one valid block of each kind.
 *
 * @returns Eight blocks, one per {@link AssistantBlockKind}, in enum order.
 */
export function buildAssistantBlockOfEveryKind(): readonly AssistantBlock[] {
  return [
    buildScheduleOptionsBlock(),
    buildPlanEvidenceBlock(),
    buildAcademicSummaryBlock(),
    buildPolicyResultsBlock(),
    buildConstraintProposalBlock(),
    buildCasePreviewBlock(),
    buildNoticeBlock(),
    buildReferralBlock(),
  ];
}
