/**
 * @file Fixed referral texts, one per SpecialistTopic, including the crisis referral.
 * @module @caa/assistant/templates/referral
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { SpecialistTopic } from '@caa/domain';

const NOT_DETERMINED =
  'This app cannot make that determination, and a schedule that fits your degree says nothing about it. Please ask the office listed below.';

/** Fixed text for each topic. Crisis never promises contact and says chat is not live. */
export const REFERRAL_TEMPLATES: Record<SpecialistTopic, string> = {
  [SpecialistTopic.FinancialAid]: `Financial aid questions need the financial aid office. ${NOT_DETERMINED}`,
  [SpecialistTopic.Immigration]: `Immigration and visa questions need your international student office. ${NOT_DETERMINED}`,
  [SpecialistTopic.Athletics]: `Athletics questions need your athletics compliance office. ${NOT_DETERMINED}`,
  [SpecialistTopic.Accessibility]: `Accessibility and accommodation questions need your accessibility services office. ${NOT_DETERMINED}`,
  [SpecialistTopic.Appeals]: `Appeals need your institution’s official appeals process. ${NOT_DETERMINED}`,
  [SpecialistTopic.Crisis]:
    'If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.',
};

/** Template id of the tier-1 crisis referral. */
export const CRISIS_TEMPLATE_ID = 'referral.crisis';

/** Template id recorded with each referral; the id never changes when its text does (the version does). */
export const REFERRAL_TEMPLATE_IDS: Record<SpecialistTopic, string> = {
  [SpecialistTopic.FinancialAid]: 'referral.financial-aid',
  [SpecialistTopic.Immigration]: 'referral.immigration',
  [SpecialistTopic.Athletics]: 'referral.athletics',
  [SpecialistTopic.Accessibility]: 'referral.accessibility',
  [SpecialistTopic.Appeals]: 'referral.appeals',
  [SpecialistTopic.Crisis]: CRISIS_TEMPLATE_ID,
};

/** Template id recorded for the tier-2 crisis-support referral. */
export const CRISIS_SUPPORT_TEMPLATE_ID = 'referral.crisis-support';

/**
 * Tier-2 crisis-support text (ADR-0015 Amendment 1): shown with the model's answer when the message is ambiguous.
 * Names the same resources as the crisis referral and promises no contact.
 */
export const CRISIS_SUPPORT_REFERRAL = {
  templateId: CRISIS_SUPPORT_TEMPLATE_ID,
  topic: SpecialistTopic.Crisis,
  text: 'If any part of your message is about your safety or how you are feeling, support is available. If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.',
} as const;

/**
 * Renders the fixed text for a referral.
 *
 * @param topic - The specialist topic.
 * @returns The fixed template text.
 */
export function renderReferral(topic: SpecialistTopic): string {
  return REFERRAL_TEMPLATES[topic];
}
