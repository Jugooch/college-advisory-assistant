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
  /** The server chose the reply instead of the model (invalid intro id or tier-1 crisis). */
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

/**
 * Schema for the statuses a stored assistant turn can carry. `RATE_LIMITED` and `DISABLED`
 * store nothing (ADR-0015 §2), so a turn with either is refused.
 */
export const StoredModelStatusSchema = z.enum([
  ModelStatus.Answered,
  ModelStatus.Guarded,
  ModelStatus.BudgetExhausted,
  ModelStatus.ModelUnavailable,
]);
