/**
 * @file Tests of the per-turn budget.
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';

import {
  canCallModel,
  canRunTool,
  NO_USAGE,
  recordModelCall,
  recordToolCall,
  TURN_BUDGET,
} from './conversation-loop.logic';

describe('turn budget', () => {
  it('allows three model calls and no more', () => {
    let usage = NO_USAGE;
    for (let call = 0; call < TURN_BUDGET.modelCalls; call += 1) {
      expect(canCallModel(usage, 0)).toBe(true);
      usage = recordModelCall(usage);
    }
    expect(canCallModel(usage, 0)).toBe(false);
  });

  it('allows four tool calls and one plan request', () => {
    const afterPlan = recordToolCall(NO_USAGE, true);

    expect(canRunTool(afterPlan, true, 0)).toBe(false);
    expect(canRunTool(afterPlan, false, 0)).toBe(true);
    let usage = NO_USAGE;
    for (let call = 0; call < TURN_BUDGET.toolCalls; call += 1)
      usage = recordToolCall(usage, false);
    expect(canRunTool(usage, false, 0)).toBe(false);
  });

  it('stops at 25 seconds', () => {
    expect(canCallModel(NO_USAGE, TURN_BUDGET.totalMs - 1)).toBe(true);
    expect(canCallModel(NO_USAGE, TURN_BUDGET.totalMs)).toBe(false);
    expect(canRunTool(NO_USAGE, false, TURN_BUDGET.totalMs)).toBe(false);
  });
});
