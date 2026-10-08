/**
 * @file Why a fixed notice block was shown.
 * @module @caa/domain/enums/notice-code
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** Why a fixed notice block was shown. */
export const NoticeCode = {
  HypotheticalNotSupported: 'HYPOTHETICAL_NOT_SUPPORTED',
  OverrideProcess: 'OVERRIDE_PROCESS',
  GradeDispute: 'GRADE_DISPUTE',
  PlannerInputNeeded: 'PLANNER_INPUT_NEEDED',
  ToolFailed: 'TOOL_FAILED',
  ModelUnavailable: 'MODEL_UNAVAILABLE',
  BudgetExhausted: 'BUDGET_EXHAUSTED',
  RateLimited: 'RATE_LIMITED',
  Disabled: 'DISABLED',
  PolicyConflict: 'POLICY_CONFLICT',
} as const;

/** Union of every {@link NoticeCode} value. */
export type NoticeCode = (typeof NoticeCode)[keyof typeof NoticeCode];

/** Runtime schema for {@link NoticeCode}. */
export const NoticeCodeSchema = z.enum(NoticeCode);
