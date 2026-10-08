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
  type PolicyRevisionRef,
  type SpecialistTopic,
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
