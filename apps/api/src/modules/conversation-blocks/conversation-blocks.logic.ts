/**
 * @file Pure block rules for a conversation turn: the order and cap of a turn's blocks, the
 * policy revisions they show, and the references stored in place of results. Nothing here reads
 * a clock, a store, or a service.
 * @module @caa/api/modules/conversation-blocks/conversation-blocks.logic
 * @requirement FR-01
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC44
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 5 and 7, Amendment 1)
 */
import type { AssistantBlock, PolicyHit } from '@caa/api-contract';
import {
  AssistantBlockKind,
  type AssistantBlockRef,
  MAX_TURN_BLOCKS,
  NoticeCode,
  type PolicyRevisionRef,
  SpecialistTopic,
} from '@caa/domain';

/** An approved referral document for a topic and the instant it was judged to apply at. */
export interface ReferralPolicy {
  readonly hit: PolicyHit;
  readonly asOf: string;
}

/** Referral documents found for the topics a message matched. */
export type ReferralPolicies = ReadonlyMap<SpecialistTopic, ReferralPolicy>;

/**
 * Orders a turn's blocks and keeps them within the cap. Detector blocks and the status notice
 * are safety content and are kept first; tool blocks are cut to fit.
 *
 * @param detector - Blocks the message detectors added.
 * @param tools - Blocks this turn's tool calls produced, in call order.
 * @param status - The status notice, or `null` when the turn has none.
 * @returns At most {@link MAX_TURN_BLOCKS} blocks: detectors, tools, then the status notice.
 */
export function orderBlocks(
  detector: readonly AssistantBlock[],
  tools: readonly AssistantBlock[],
  status: AssistantBlock | null,
): readonly AssistantBlock[] {
  const tail = status === null ? [] : [status];
  const head = detector.slice(0, MAX_TURN_BLOCKS - tail.length);
  const room = MAX_TURN_BLOCKS - head.length - tail.length;
  return [...head, ...tools.slice(0, room), ...tail];
}

/**
 * Lists the policy revisions a turn's blocks show, for the turn's metadata.
 *
 * @param blocks - The turn's blocks.
 * @returns Each policy document key and revision, once.
 */
export function policyRevisionsOf(blocks: readonly AssistantBlock[]): readonly PolicyRevisionRef[] {
  const seen = new Map<string, PolicyRevisionRef>();
  for (const block of blocks) {
    const hits =
      block.kind === AssistantBlockKind.PolicyResults
        ? block.results.hits
        : block.kind === AssistantBlockKind.Referral && block.policy !== null
          ? [block.policy]
          : [];
    for (const { documentKey, revision } of hits) {
      seen.set(`${documentKey}#${String(revision)}`, { documentKey, revision });
    }
  }
  return [...seen.values()];
}

/**
 * Reduces a block to the reference stored in the transcript. No result payload is kept, so a
 * stored PASS can never be shown as current (ADR-0015 section 7).
 *
 * @param block - A block shown this turn.
 * @param shownAt - When it was shown, ISO 8601 with offset.
 * @returns The stored reference.
 */
export function toBlockRef(block: AssistantBlock, shownAt: string): AssistantBlockRef {
  switch (block.kind) {
    case AssistantBlockKind.ScheduleOptions:
    case AssistantBlockKind.AcademicSummary:
      return { kind: block.kind, shownAt };
    case AssistantBlockKind.PlanEvidence:
      return {
        kind: block.kind,
        planId: block.plan.planId,
        planRevisionId: block.plan.id,
        revision: block.plan.revision,
      };
    case AssistantBlockKind.PolicyResults:
      return {
        kind: block.kind,
        documents: block.results.hits.map(({ documentKey, revision }) => ({
          documentKey,
          revision,
        })),
      };
    case AssistantBlockKind.ConstraintProposal:
      return { kind: block.kind, constraints: block.constraints.map((entry) => entry.constraint) };
    case AssistantBlockKind.CasePreview:
      return { kind: block.kind, reason: block.reason };
    case AssistantBlockKind.Notice:
      return {
        kind: block.kind,
        code: block.code,
        templateId: block.templateId,
        templateVersion: block.templateVersion,
      };
    case AssistantBlockKind.Referral:
      return {
        kind: block.kind,
        topic: block.topic,
        templateId: block.templateId,
        templateVersion: block.templateVersion,
      };
  }
}

/** What the message detectors matched, as plain values. */
export interface DetectorFacts {
  /** Tier-1 crisis language. */
  readonly isCrisisUnambiguous: boolean;
  /** Tier-2 (ambiguous) crisis language. */
  readonly isCrisisAmbiguous: boolean;
  readonly specialistTopics: readonly SpecialistTopic[];
  readonly isHypothetical: boolean;
  readonly isOverride: boolean;
  readonly isGradeDispute: boolean;
}

/** One detector block to build, in display order. */
export type DetectorSlot =
  | { readonly slot: 'CRISIS' }
  | { readonly slot: 'CRISIS_SUPPORT' }
  | { readonly slot: 'REFERRAL'; readonly topic: SpecialistTopic }
  | { readonly slot: 'NOTICE'; readonly code: NoticeCode };

/**
 * Decides which detector blocks a message adds and their order: crisis first, then specialist
 * referrals, then the hypothetical, override and grade notices.
 *
 * @param facts - What the detectors matched.
 * @returns The slots in display order.
 */
export function planDetectorBlocks(facts: DetectorFacts): readonly DetectorSlot[] {
  // SAFETY: a tier-1 turn shows only the crisis referral (Amendment 1).
  if (facts.isCrisisUnambiguous) return [{ slot: 'CRISIS' }];
  const slots: DetectorSlot[] = [];
  if (facts.isCrisisAmbiguous) slots.push({ slot: 'CRISIS_SUPPORT' });
  for (const topic of facts.specialistTopics) slots.push({ slot: 'REFERRAL', topic });
  if (facts.isHypothetical) {
    slots.push({ slot: 'NOTICE', code: NoticeCode.HypotheticalNotSupported });
  }
  if (facts.isOverride) slots.push({ slot: 'NOTICE', code: NoticeCode.OverrideProcess });
  if (facts.isGradeDispute) slots.push({ slot: 'NOTICE', code: NoticeCode.GradeDispute });
  return slots;
}

/**
 * Lists the specialist topics a message needs a referral document for, crisis included.
 *
 * @param slots - The planned detector blocks.
 * @returns The topics, crisis first.
 */
export function referralTopics(slots: readonly DetectorSlot[]): readonly SpecialistTopic[] {
  return slots.flatMap((entry): readonly SpecialistTopic[] => {
    if (entry.slot === 'REFERRAL') return [entry.topic];
    return entry.slot === 'NOTICE' ? [] : [SpecialistTopic.Crisis];
  });
}
