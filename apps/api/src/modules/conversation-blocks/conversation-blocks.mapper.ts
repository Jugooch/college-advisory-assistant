/**
 * @file Builds the fixed blocks of a conversation turn from the assistant's templates: the
 * blocks the message detectors add (crisis, specialist referrals, hypothetical, override and
 * grade notices) and the notice that explains a non-answer status.
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
import { AssistantBlockKind, NoticeCode, SpecialistTopic } from '@caa/domain';

import type { ReferralPolicies, ReferralPolicy } from './conversation-blocks.logic';

/** Template id of the tier-1 crisis referral. */
export const CRISIS_TEMPLATE_ID = 'referral.crisis';

/**
 * Lists the specialist topics a message needs a referral document for, crisis included.
 *
 * @param matches - What the detectors matched.
 * @returns The topics, crisis first.
 */
export function referralTopics(matches: FixedResponseMatches): readonly SpecialistTopic[] {
  // SAFETY: a tier-1 turn shows only the crisis referral (Amendment 1).
  if (matches.crisis === CrisisTier.Unambiguous) return [SpecialistTopic.Crisis];
  return matches.crisis === CrisisTier.None
    ? matches.specialistTopics
    : [SpecialistTopic.Crisis, ...matches.specialistTopics];
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

const referral = (
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
 * Builds the blocks the student's message adds, whatever the model does: crisis first, then
 * specialist referrals, then the hypothetical, override and grade notices.
 *
 * @param matches - What the detectors matched.
 * @param referrals - Approved referral documents, by topic.
 * @param asOf - The instant to record when a topic has no document.
 * @returns The detector blocks in display order.
 */
export function detectorBlocks(
  matches: FixedResponseMatches,
  referrals: ReferralPolicies,
  asOf: string,
): readonly AssistantBlock[] {
  const crisis = referrals.get(SpecialistTopic.Crisis);
  const blocks: AssistantBlock[] = [];
  if (matches.crisis === CrisisTier.Unambiguous) {
    const content = {
      topic: SpecialistTopic.Crisis,
      templateId: CRISIS_TEMPLATE_ID,
      text: renderReferral(SpecialistTopic.Crisis),
    };
    return [referral(content, crisis, asOf)];
  }
  if (matches.crisis === CrisisTier.Ambiguous) {
    blocks.push(referral(CRISIS_SUPPORT_REFERRAL, crisis, asOf));
  }
  for (const topic of matches.specialistTopics) {
    const templateId = `referral.${topic.toLowerCase().replaceAll('_', '-')}`;
    const content = { topic, templateId, text: renderReferral(topic) };
    blocks.push(referral(content, referrals.get(topic), asOf));
  }
  if (matches.hypothetical) blocks.push(fixedNotice(NoticeCode.HypotheticalNotSupported));
  if (matches.override) blocks.push(fixedNotice(NoticeCode.OverrideProcess));
  if (matches.gradeDispute) blocks.push(fixedNotice(NoticeCode.GradeDispute));
  return blocks;
}
