/**
 * @file How the model boundary ended for one assistant turn.
 * @module @caa/domain/enums/model-status
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** How the model boundary ended for one assistant turn. */
export const ModelStatus = {
  Answered: 'ANSWERED',
  Guarded: 'GUARDED',
  BudgetExhausted: 'BUDGET_EXHAUSTED',
  ModelUnavailable: 'MODEL_UNAVAILABLE',
  RateLimited: 'RATE_LIMITED',
  Disabled: 'DISABLED',
} as const;

/** Union of every {@link ModelStatus} value. */
export type ModelStatus = (typeof ModelStatus)[keyof typeof ModelStatus];

/** Runtime schema for {@link ModelStatus}. */
export const ModelStatusSchema = z.enum(ModelStatus);
