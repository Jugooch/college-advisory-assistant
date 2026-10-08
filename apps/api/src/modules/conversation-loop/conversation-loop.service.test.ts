/**
 * @file Tests of the 25-second turn limit with an injected clock and fake timers: a model that
 * never answers, time running out between calls, and time running out between tool calls.
 * @requirement FR-10
 * @requirement NFR-05
 * @requirement AC46
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ConversationModel,
  type ModelReply,
  scriptedToolCall,
  ToolName,
} from '@caa/assistant';
import { buildNoticeBlock } from '@caa/test-kit';

import { ownStudent, studentActor, toolContext } from '../../testing/conversation-tools-harness';
import type { ToolOutcome } from '../conversation-tools/conversation-tools.logic';
import { LoopEnd } from './conversation-loop.logic';
import { createConversationLoopService } from './conversation-loop.service';

const START = new Date('2026-09-01T12:00:00.000Z').getTime();
const TOOL_REPLY: ModelReply = {
  text: '',
  toolCalls: [scriptedToolCall('c1', ToolName.GetAcademicSummary)],
  stopReason: 'TOOL_USE',
};
const TWO_TOOLS: ModelReply = {
  text: '',
  toolCalls: [
    scriptedToolCall('c1', ToolName.GetAcademicSummary),
    scriptedToolCall('c2', ToolName.GetAcademicSummary),
  ],
  stopReason: 'TOOL_USE',
};
const NEVER = new Promise<ModelReply>(() => undefined);

interface Rig {
  readonly clock: { ms: number };
  readonly executeTool: ReturnType<typeof vi.fn<() => Promise<ToolOutcome>>>;
  readonly respond: ReturnType<typeof vi.fn<ConversationModel['respond']>>;
  readonly run: () => ReturnType<ReturnType<typeof createConversationLoopService>['run']>;
}

/**
 * Builds a loop whose tool call moves the clock forward.
 *
 * @param replies - The model's replies in order; a call past them never answers.
 * @param toolTakesMs - How far each tool call moves the injected clock.
 * @returns The loop's runner, its clock, and the model and tool spies.
 */
function rig(replies: readonly Promise<ModelReply>[], toolTakesMs: number): Rig {
  const clock = { ms: START };
  const outcome: ToolOutcome = {
    projection: {},
    modelText: 'data',
    block: buildNoticeBlock(),
    notice: null,
    errorCode: null,
  };
  const executeTool = vi.fn<() => Promise<ToolOutcome>>(() => {
    clock.ms += toolTakesMs;
    return Promise.resolve(outcome);
  });
  const queue = [...replies];
  const respond = vi.fn<ConversationModel['respond']>(() => queue.shift() ?? NEVER);
  const loop = createConversationLoopService({
    model: { respond },
    tools: { executeTool },
    now: () => new Date(clock.ms),
  });
  const run = () =>
    loop.run(
      { actor: studentActor, studentId: ownStudent.id, history: [], message: 'Hi' },
      toolContext,
    );
  return { clock, executeTool, respond, run };
}

describe('the turn deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends MODEL_UNAVAILABLE when the model has not answered in 25 seconds', async () => {
    const { run, respond } = rig([NEVER], 0);

    const pending = run();
    await vi.advanceTimersByTimeAsync(24_999);
    const early = await Promise.race([pending, Promise.resolve('PENDING')]);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(early).toBe('PENDING');
    expect(result.end).toBe(LoopEnd.ModelUnavailable);
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('gives the next model call only the time that is left', async () => {
    const { run, respond } = rig([Promise.resolve(TOOL_REPLY), NEVER], 20_000);

    const pending = run();
    await vi.advanceTimersByTimeAsync(4_999);
    const early = await Promise.race([pending, Promise.resolve('PENDING')]);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(early).toBe('PENDING');
    expect(result.end).toBe(LoopEnd.ModelUnavailable);
    expect(respond).toHaveBeenCalledTimes(2);
    expect(result.blocks).toHaveLength(1);
  });

  it('ends BUDGET_EXHAUSTED without another model call when time ran out during a tool', async () => {
    const { run, respond, executeTool } = rig([Promise.resolve(TOOL_REPLY)], 25_000);

    const result = await run();

    expect(result.end).toBe(LoopEnd.BudgetExhausted);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.blocks).toHaveLength(1);
  });

  it('skips the remaining tool calls once time has run out', async () => {
    const { run, executeTool } = rig([Promise.resolve(TWO_TOOLS)], 25_000);

    const result = await run();

    expect(result.end).toBe(LoopEnd.BudgetExhausted);
    expect(executeTool).toHaveBeenCalledTimes(1);
  });
});
