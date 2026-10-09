/**
 * @file The bounded model loop of one turn: calls the model, runs its tool calls for the
 * session's student, and feeds the results back, within the turn budget. It returns the blocks
 * the tools produced and the model's final reply text for the intro resolver; it never shows,
 * stores or logs model text.
 * @module @caa/api/modules/conversation-loop/conversation-loop.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 to 4)
 */
import type { AssistantBlock, ScheduleOptionsRequest } from '@caa/api-contract';
import {
  type ConversationModel,
  MODEL_TOOL_DEFINITIONS,
  type ModelMessage,
  type ModelReply,
  SYSTEM_PROMPT,
  TOOL_NAMES,
  ToolName,
} from '@caa/assistant';
import type { Actor, StudentId } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import type { ConversationToolsService } from '../conversation-tools/conversation-tools.service';
import {
  type BudgetUsage,
  canCallModel,
  canRunTool,
  LoopEnd,
  type LoopResult,
  NO_USAGE,
  recordModelCall,
  recordToolCall,
  TURN_BUDGET,
} from './conversation-loop.logic';

/** Dependencies of the model loop. */
export interface ConversationLoopServiceDependencies {
  readonly model: ConversationModel;
  readonly tools: Pick<ConversationToolsService, 'executeTool'>;
  /** Returns the current time; the turn's 25-second limit is measured with it. */
  readonly now: () => Date;
}

/** What the loop needs, none of it from the model. */
export interface LoopInput {
  readonly actor: Actor;
  readonly studentId: StudentId;
  /** Earlier server-written messages, oldest first. */
  readonly history: readonly ModelMessage[];
  readonly message: string;
  readonly plannerInputs?: ScheduleOptionsRequest | undefined;
}

/** Runs the model loop. */
export interface ConversationLoopService {
  /**
   * Runs one turn's model loop.
   *
   * @param input - Actor, student, history, message and planner form state.
   * @param context - Request-scoped values.
   * @returns How the loop ended and what the tools produced. Never throws for a model failure.
   */
  run(input: LoopInput, context: RequestContext): Promise<LoopResult>;
}

/** The loop's working state for one turn. */
interface LoopState {
  usage: BudgetUsage;
  readonly messages: ModelMessage[];
  readonly blocks: AssistantBlock[];
  readonly toolNames: string[];
  readonly elapsed: () => number;
}

class DeadlineError extends Error {}

/**
 * Rejects when a promise takes longer than the time left in the turn.
 *
 * @param promise - The model call.
 * @param ms - Milliseconds left.
 * @returns The promise's value.
 * @throws {DeadlineError} When the time runs out first.
 */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DeadlineError());
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('model call failed'));
      },
    );
  });
}

/**
 * Names a tool for logs: the catalog name, or a fixed word for one the model invented, so
 * model-chosen text is never logged.
 *
 * @param name - The name the model asked for.
 * @returns A catalog tool name or `UNKNOWN`.
 */
function loggableToolName(name: string): string {
  return TOOL_NAMES.find((candidate) => candidate === name) ?? 'UNKNOWN';
}

const finish = (state: LoopState, end: LoopEnd, finalText = ''): LoopResult => ({
  end,
  finalText,
  blocks: state.blocks,
  toolNames: state.toolNames,
  usage: state.usage,
});

/**
 * Runs the tool calls of one model reply, in order, within the budget.
 *
 * @param tools - The tools service.
 * @param calls - Turn inputs, the reply's tool calls, and the shared state to update.
 * @param context - Request-scoped values.
 * @returns `false` when the budget stopped the calls.
 */
async function runToolCalls(
  tools: ConversationLoopServiceDependencies['tools'],
  calls: {
    readonly input: LoopInput;
    readonly list: ModelReply['toolCalls'];
    readonly state: LoopState;
  },
  context: RequestContext,
): Promise<boolean> {
  const { input, list, state } = calls;
  for (const call of list) {
    const isPlan = call.name === ToolName.RequestPlan;
    if (!canRunTool(state.usage, isPlan, state.elapsed())) return false;
    state.usage = recordToolCall(state.usage, isPlan);
    state.toolNames.push(loggableToolName(call.name));
    // SECURITY: the student is the path's, checked against the session by the tools service;
    // nothing the model wrote selects who the tool runs for.
    // NOTE: the tool shares the turn's remaining time; running out ends the turn (ADR-0015 section 2).
    const outcome = await withDeadline(
      tools.executeTool(
        input.actor,
        { call, studentId: input.studentId, plannerInputs: input.plannerInputs },
        context,
      ),
      TURN_BUDGET.totalMs - state.elapsed(),
    ).catch((error: unknown) => {
      if (error instanceof DeadlineError) return null;
      throw error;
    });
    if (outcome === null) return false;
    state.blocks.push(...[outcome.block, outcome.notice].filter((block) => block !== null));
    state.messages.push({
      role: 'tool',
      toolCallId: call.id,
      toolName: call.name,
      content: outcome.modelText,
    });
  }
  return true;
}

/**
 * Creates the model loop.
 *
 * @param dependencies - The model, the tools, and the clock.
 * @returns A {@link ConversationLoopService}.
 */
export function createConversationLoopService(
  dependencies: ConversationLoopServiceDependencies,
): ConversationLoopService {
  const { model, tools, now } = dependencies;

  const callModel = async (state: LoopState, context: RequestContext, tenantId: string) => {
    state.usage = recordModelCall(state.usage);
    try {
      return await withDeadline(
        model.respond({
          system: SYSTEM_PROMPT,
          messages: state.messages,
          tools: MODEL_TOOL_DEFINITIONS,
        }),
        TURN_BUDGET.totalMs - state.elapsed(),
      );
    } catch (error) {
      // SECURITY: the error's message is never logged; only its class.
      const failure = error instanceof Error ? error.name : 'unknown';
      context.logger.warn({ tenantId, failure }, 'conversation model unavailable');
      return null;
    }
  };

  return {
    async run(input, context) {
      const started = now().getTime();
      const state: LoopState = {
        usage: NO_USAGE,
        messages: [...input.history, { role: 'user', text: input.message }],
        blocks: [],
        toolNames: [],
        elapsed: () => now().getTime() - started,
      };
      while (canCallModel(state.usage, state.elapsed())) {
        const reply = await callModel(state, context, input.actor.tenantId);
        if (reply === null) return finish(state, LoopEnd.ModelUnavailable);
        if (reply.toolCalls.length === 0) {
          // SAFETY: a reply cut off by the token limit is never read as an intro id.
          return finish(state, LoopEnd.Final, reply.stopReason === 'MAX_TOKENS' ? '' : reply.text);
        }
        // SAFETY: text alongside tool calls is discarded, so it can't be replayed or shown.
        state.messages.push({ role: 'assistant', text: '', toolCalls: reply.toolCalls });
        const list = reply.toolCalls;
        if (!(await runToolCalls(tools, { input, list, state }, context))) break;
      }
      return finish(state, LoopEnd.BudgetExhausted);
    },
  };
}
