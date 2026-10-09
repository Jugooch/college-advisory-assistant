/**
 * @file Runs the message detectors for a turn and builds the fixed blocks they add. Each
 * referral block carries the approved referral document for its topic when one exists.
 * @module @caa/api/modules/conversation-blocks/conversation-blocks.service
 * @requirement FR-10
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 5, Amendment 1)
 */
import type { AssistantBlock } from '@caa/api-contract';
import { detectFixedResponses } from '@caa/assistant';
import type { Actor, SpecialistTopic } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import type { PolicySearchService } from '../policy-search/policy-search.service';
import {
  planDetectorBlocks,
  type ReferralPolicy,
  referralTopics,
} from './conversation-blocks.logic';
import { detectorBlocks, detectorFacts } from './conversation-blocks.mapper';

/** Dependencies of the detector blocks service. */
export interface ConversationBlocksServiceDependencies {
  readonly policySearch: Pick<PolicySearchService, 'search'>;
}

/** What the detectors read and the time to record. */
export interface DetectInput {
  readonly message: string;
  /** The injected clock's instant, ISO 8601 with offset. */
  readonly at: string;
}

/** What the detectors found in a message. */
export interface DetectedBlocks {
  /** Blocks to show at every status, in display order. */
  readonly blocks: readonly AssistantBlock[];
  /** Tier-1 crisis language: the model must not be called. */
  readonly isCrisisUnambiguous: boolean;
}

/** Builds the blocks a student's message adds. */
export interface ConversationBlocksService {
  /**
   * Runs the detectors on the message alone and builds their blocks.
   *
   * @param actor - Authenticated actor from the session.
   * @param input - The student's message and the instant to record when a topic has no
   * referral document.
   * @param context - Request-scoped values.
   * @returns The blocks and whether the message is tier-1 crisis language.
   */
  detect(actor: Actor, input: DetectInput, context: RequestContext): Promise<DetectedBlocks>;
}

/**
 * Creates the detector blocks service.
 *
 * @param dependencies - The policy search used to find referral documents.
 * @returns A {@link ConversationBlocksService}.
 */
export function createConversationBlocksService(
  dependencies: ConversationBlocksServiceDependencies,
): ConversationBlocksService {
  const { policySearch } = dependencies;

  const lookupReferrals = async (
    actor: Actor,
    topics: readonly SpecialistTopic[],
    context: RequestContext,
  ) => {
    const found = new Map<SpecialistTopic, ReferralPolicy>();
    for (const topic of topics) {
      try {
        const result = await policySearch.search(actor, { topic }, context);
        const hit = result.hits.find((candidate) => candidate.topic === topic);
        if (hit !== undefined) found.set(topic, { hit, asOf: result.asOf });
      } catch {
        // NOTE: a missing referral document never blocks the fixed referral text.
        context.logger.warn({ tenantId: actor.tenantId, topic }, 'referral document unavailable');
      }
    }
    return found;
  };

  return {
    async detect(actor, input, context) {
      // SAFETY: the detectors run on the message alone, before and apart from any model.
      const facts = detectorFacts(detectFixedResponses(input.message));
      const slots = planDetectorBlocks(facts);
      const referrals = await lookupReferrals(actor, referralTopics(slots), context);
      return {
        blocks: detectorBlocks(slots, referrals, input.at),
        isCrisisUnambiguous: facts.isCrisisUnambiguous,
      };
    },
  };
}
