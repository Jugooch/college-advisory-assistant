/**
 * @file Subject area of a policy document.
 * @module @caa/domain/enums/policy-topic
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { SpecialistTopic } from './specialist-topic.enum';

/** Topic of a policy document: general information or one specialist topic. */
export const PolicyTopic = {
  General: 'GENERAL',
  ...SpecialistTopic,
} as const;

/** Union of every {@link PolicyTopic} value. */
export type PolicyTopic = (typeof PolicyTopic)[keyof typeof PolicyTopic];

/** Runtime schema for {@link PolicyTopic}. */
export const PolicyTopicSchema = z.enum(PolicyTopic);
