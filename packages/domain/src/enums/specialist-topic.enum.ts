/**
 * @file Topics that belong to a specialist office, not to the assistant.
 * @module @caa/domain/enums/specialist-topic
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** A topic the assistant refers to a specialist for instead of answering. */
export const SpecialistTopic = {
  FinancialAid: 'FINANCIAL_AID',
  Immigration: 'IMMIGRATION',
  Athletics: 'ATHLETICS',
  Accessibility: 'ACCESSIBILITY',
  Appeals: 'APPEALS',
  Crisis: 'CRISIS',
} as const;

/** Union of every {@link SpecialistTopic} value. */
export type SpecialistTopic = (typeof SpecialistTopic)[keyof typeof SpecialistTopic];

/** Runtime schema for {@link SpecialistTopic}. */
export const SpecialistTopicSchema = z.enum(SpecialistTopic);
