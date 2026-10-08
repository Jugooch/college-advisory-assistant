/**
 * @file Who an approved policy document is written for.
 * @module @caa/domain/enums/policy-audience
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** Audience of a policy document. Which audiences a role may read is decided in the api. */
export const PolicyAudience = {
  Student: 'STUDENT',
  Advisor: 'ADVISOR',
  All: 'ALL',
} as const;

/** Union of every {@link PolicyAudience} value. */
export type PolicyAudience = (typeof PolicyAudience)[keyof typeof PolicyAudience];

/** Runtime schema for {@link PolicyAudience}. */
export const PolicyAudienceSchema = z.enum(PolicyAudience);
