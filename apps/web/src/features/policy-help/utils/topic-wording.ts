/**
 * @file Fixed wording for the specialist topics on the where-to-ask list, and their order.
 * @module @caa/web/features/policy-help/utils/topic-wording
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { SpecialistTopic } from '@caa/domain';

/** Topics in display order. Crisis support comes first (ADR-0015 section 8). */
export const WHERE_TO_ASK_TOPICS: readonly SpecialistTopic[] = [
  SpecialistTopic.Crisis,
  SpecialistTopic.FinancialAid,
  SpecialistTopic.Immigration,
  SpecialistTopic.Athletics,
  SpecialistTopic.Accessibility,
  SpecialistTopic.Appeals,
];

/** The line shown when the tenant has no approved referral document for a topic. */
export const ASK_ADVISING_OFFICE = 'Ask your advising office.';

const LABELS: Readonly<Record<SpecialistTopic, string>> = {
  CRISIS: 'Crisis or urgent personal support',
  FINANCIAL_AID: 'Financial aid',
  IMMIGRATION: 'Immigration and visas',
  ATHLETICS: 'Athletics eligibility',
  ACCESSIBILITY: 'Accessibility and accommodations',
  APPEALS: 'Appeals and exceptions',
};

/**
 * Names a topic for a heading.
 *
 * @param topic - The specialist topic.
 * @returns Its fixed label.
 */
export function describeTopic(topic: SpecialistTopic): string {
  return LABELS[topic];
}
