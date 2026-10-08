/**
 * @file The per-turn budget for the model loop: how many model calls, tool calls and plan
 * requests a turn may use, and how long it may run. Pure counting; the caller supplies elapsed
 * time from the injected clock.
 * @module @caa/api/modules/conversation-loop/conversation-loop.logic
 * @requirement FR-01
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 2)
 */
import type { AssistantBlock } from '@caa/api-contract';

/** What one turn may spend (ADR-0015 section 2). */
export const TURN_BUDGET = {
  modelCalls: 3,
  toolCalls: 4,
  requestPlanCalls: 1,
  totalMs: 25_000,
} as const;

/** What a turn has spent so far. */
export interface BudgetUsage {
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly requestPlanCalls: number;
}

/** A turn that has spent nothing. */
export const NO_USAGE: BudgetUsage = { modelCalls: 0, toolCalls: 0, requestPlanCalls: 0 };

/**
 * Says whether another model call fits the budget.
 *
 * @param usage - Spent so far.
 * @param elapsedMs - Time since the turn began.
 * @returns `true` while model calls and time remain.
 */
export function canCallModel(usage: BudgetUsage, elapsedMs: number): boolean {
  return usage.modelCalls < TURN_BUDGET.modelCalls && elapsedMs < TURN_BUDGET.totalMs;
}

/**
 * Says whether another tool call fits the budget. A call past it is not executed.
 *
 * @param usage - Spent so far.
 * @param isPlanRequest - Whether the call is `request_plan`, which has its own limit.
 * @param elapsedMs - Time since the turn began.
 * @returns `true` while tool calls (and plan requests, for `request_plan`) and time remain.
 */
export function canRunTool(usage: BudgetUsage, isPlanRequest: boolean, elapsedMs: number): boolean {
  return (
    usage.toolCalls < TURN_BUDGET.toolCalls &&
    elapsedMs < TURN_BUDGET.totalMs &&
    (!isPlanRequest || usage.requestPlanCalls < TURN_BUDGET.requestPlanCalls)
  );
}

/**
 * Counts a model call.
 *
 * @param usage - Spent so far.
 * @returns The new usage.
 */
export function recordModelCall(usage: BudgetUsage): BudgetUsage {
  return { ...usage, modelCalls: usage.modelCalls + 1 };
}

/**
 * Counts a tool call, valid or not.
 *
 * @param usage - Spent so far.
 * @param isPlanRequest - Whether the call is `request_plan`.
 * @returns The new usage.
 */
export function recordToolCall(usage: BudgetUsage, isPlanRequest: boolean): BudgetUsage {
  return {
    ...usage,
    toolCalls: usage.toolCalls + 1,
    requestPlanCalls: usage.requestPlanCalls + (isPlanRequest ? 1 : 0),
  };
}

/** How the loop ended. */
export const LoopEnd = {
  /** The model replied without asking for a tool. */
  Final: 'FINAL',
  /** A budget limit stopped the loop. */
  BudgetExhausted: 'BUDGET_EXHAUSTED',
  /** The model call failed or timed out. */
  ModelUnavailable: 'MODEL_UNAVAILABLE',
} as const;

/** Union of every {@link LoopEnd} value. */
export type LoopEnd = (typeof LoopEnd)[keyof typeof LoopEnd];

/** What the loop produced. */
export interface LoopResult {
  readonly end: LoopEnd;
  /** The final reply, for the intro resolver only; `''` unless `end` is `FINAL`. */
  readonly finalText: string;
  /** Blocks and notices from the tool calls, in call order. */
  readonly blocks: readonly AssistantBlock[];
  /** Catalog names of the tools called, `UNKNOWN` for an invented one. */
  readonly toolNames: readonly string[];
  readonly usage: BudgetUsage;
}
