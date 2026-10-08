/**
 * @file Tests for the scripted model fake.
 */
import { describe, expect, it } from 'vitest';

import type { ModelRequest } from '../ports/conversation-model.port';
import { resolveIntro } from '../templates/intro.template';
import { ALL_TOOLS } from '../tools/all-tools.tool';
import { ToolName } from '../tools/tool-catalog';
import {
  createScriptedModel,
  failureStep,
  finalStep,
  MisbehavingStep,
  ScriptedFailure,
  ScriptedModelError,
  scriptedToolCall,
  toolCallStep,
} from './scripted-model.fake';

const REQUEST: ModelRequest = {
  system: 'system',
  messages: [{ role: 'user', text: 'hello' }],
  tools: [],
};

describe('createScriptedModel', () => {
  it('replays reply steps in order with stop reasons', async () => {
    const call = scriptedToolCall('c1', ToolName.RequestPlan);
    const model = createScriptedModel([toolCallStep(call), finalStep('SCHEDULE_OPTIONS')]);
    expect(await model.respond(REQUEST)).toEqual({
      text: '',
      toolCalls: [call],
      stopReason: 'TOOL_USE',
    });
    expect(await model.respond(REQUEST)).toEqual({
      text: 'SCHEDULE_OPTIONS',
      toolCalls: [],
      stopReason: 'END_TURN',
    });
    expect(model.remaining()).toBe(0);
  });

  it.each([ScriptedFailure.Unavailable, ScriptedFailure.Timeout])('fails with %s', async (kind) => {
    const model = createScriptedModel([failureStep(kind)]);
    await expect(model.respond(REQUEST)).rejects.toMatchObject({
      name: ScriptedModelError.name,
      failure: kind,
    });
  });

  it('rejects when the script runs out', async () => {
    const model = createScriptedModel([]);
    await expect(model.respond(REQUEST)).rejects.toThrow('script ran out');
  });

  it('records each request as it was when sent', async () => {
    const model = createScriptedModel([finalStep('ASK_FOR_DETAIL'), finalStep('ASK_FOR_DETAIL')]);
    const messages: ModelRequest['messages'][number][] = [{ role: 'user', text: 'one' }];
    await model.respond({ ...REQUEST, messages });
    messages.push({ role: 'user', text: 'two' });
    await model.respond({ ...REQUEST, messages });
    expect(model.requests.map((r) => r.messages.length)).toEqual([1, 2]);
  });
});

describe('MisbehavingStep', () => {
  it('puts identity fields in tool arguments', () => {
    const [call] = MisbehavingStep.identityInArguments.toolCalls;
    expect(call?.arguments).toEqual({ tenantId: 'tenant-synthetic', userId: 'user-synthetic' });
  });

  it('names a tool outside the catalog', () => {
    const [call] = MisbehavingStep.unknownTool.toolCalls;
    expect(ALL_TOOLS.map((tool) => tool.name)).not.toContain(call?.name);
  });

  it.each([
    ['proseInsteadOfIntro', 'INTRO_NOT_AN_ID'],
    ['consequentialText', 'INTRO_NOT_AN_ID'],
    ['unknownIntroId', 'INTRO_NOT_AN_ID'],
    ['obeysInjectedText', 'INTRO_NOT_AN_ID'],
    ['introWithoutBlock', 'INTRO_BLOCK_MISSING'],
  ] as const)('%s never reaches the student (%s)', (name, reason) => {
    const resolved = resolveIntro(MisbehavingStep[name].text, []);
    expect(resolved.introId).toBeNull();
    expect(resolved.reasons).toEqual([reason]);
  });
});
