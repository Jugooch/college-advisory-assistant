/**
 * @file Builds the fixed blocks of a conversation turn from the assistant's templates: the
 * blocks the message detectors add (rendered from the planned slots) and the notice that
 * explains a non-answer status.
 * @module @caa/api/modules/conversation-blocks/conversation-blocks.mapper
 * @requirement FR-10
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 5, Amendment 1)
 */
import type { AssistantBlock } from '@caa/api-contract';
import {
  CRISIS_SUPPORT_REFERRAL,
  CrisisTier,
  type FixedResponseMatches,
  renderNotice,
  renderReferral,
  TEMPLATE_VERSION,
} from '@caa/assistant';
import { AssistantBlockKind, type NoticeCode, SpecialistTopic } from '@caa/domain';

import type {
  DetectorFacts,
  DetectorSlot,
  ReferralPolicies,
  ReferralPolicy,
} from './conversation-blocks.logic';

/** Template id of the tier-1 crisis referral. */
export const CRISIS_TEMPLATE_ID = 'referral.crisis';

/**
 * Reads the detectors' matches as plain facts for the block rules.
 *
 * @param matches - What the detectors matched.
 * @returns The facts.
 */
export function detectorFacts(matches: FixedResponseMatches): DetectorFacts {
  return {
    isCrisisUnambiguous: matches.crisis === CrisisTier.Unambiguous,
    isCrisisAmbiguous: matches.crisis === CrisisTier.Ambiguous,
    specialistTopics: matches.specialistTopics,
    isHypothetical: matches.hypothetical,
    isOverride: matches.override,
    isGradeDispute: matches.gradeDispute,
  };
}

/**
 * Builds a fixed notice block.
 *
 * @param code - Which notice.
 * @returns The block, with the template's current text and version.
 */
export function fixedNotice(code: NoticeCode): AssistantBlock {
  return {
    kind: AssistantBlockKind.Notice,
    code,
    templateId: `notice.${code.toLowerCase().replaceAll('_', '-')}`,
    templateVersion: TEMPLATE_VERSION,
    text: renderNotice(code),
  };
}

/** What a referral block shows. */
interface ReferralContent {
  readonly topic: SpecialistTopic;
  readonly templateId: string;
  readonly text: string;
}

const toReferralBlock = (
  content: ReferralContent,
  found: ReferralPolicy | undefined,
  fallbackAsOf: string,
): AssistantBlock => ({
  kind: AssistantBlockKind.Referral,
  ...content,
  templateVersion: TEMPLATE_VERSION,
  policy: found?.hit ?? null,
  asOf: found?.asOf ?? fallbackAsOf,
});

/**
 * Renders the planned detector blocks, in plan order.
 *
 * @param slots - The planned blocks (`planDetectorBlocks`).
 * @param referrals - Approved referral documents, by topic.
 * @param asOf - The instant to record when a topic has no document.
 * @returns The detector blocks in display order.
 */
export function detectorBlocks(
  slots: readonly DetectorSlot[],
  referrals: ReferralPolicies,
  asOf: string,
): readonly AssistantBlock[] {
  return slots.map((entry): AssistantBlock => {
    switch (entry.slot) {
      case 'CRISIS': {
        const content = {
          topic: SpecialistTopic.Crisis,
          templateId: CRISIS_TEMPLATE_ID,
          text: renderReferral(SpecialistTopic.Crisis),
        };
        return toReferralBlock(content, referrals.get(SpecialistTopic.Crisis), asOf);
      }
      case 'CRISIS_SUPPORT':
        return toReferralBlock(
          CRISIS_SUPPORT_REFERRAL,
          referrals.get(SpecialistTopic.Crisis),
          asOf,
        );
      case 'REFERRAL': {
        const templateId = `referral.${entry.topic.toLowerCase().replaceAll('_', '-')}`;
        const content = { topic: entry.topic, templateId, text: renderReferral(entry.topic) };
        return toReferralBlock(content, referrals.get(entry.topic), asOf);
      }
      case 'NOTICE':
        return fixedNotice(entry.code);
    }
  });
}
