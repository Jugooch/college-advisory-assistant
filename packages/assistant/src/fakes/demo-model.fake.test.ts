/**
 * @file Tests for the demo model fake.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind } from '@caa/domain';

import type { ModelMessage, ModelReply } from '../ports/conversation-model.port';
import { resolveIntro } from '../templates/intro.template';
import { ALL_TOOLS } from '../tools/all-tools.tool';
import { ToolName } from '../tools/tool-catalog';
import { createDemoModel } from './demo-model.fake';

const BLOCK_KIND_BY_TOOL: Record<string, AssistantBlockKind> = {
  [ToolName.RequestPlan]: AssistantBlockKind.ScheduleOptions,
  [ToolName.SearchApprovedPolicy]: AssistantBlockKind.PolicyResults,
  [ToolName.DraftCaseContext]: AssistantBlockKind.CasePreview,
  [ToolName.ProposeConstraints]: AssistantBlockKind.ConstraintProposal,
};

const SCENARIOS: readonly (readonly [string, readonly string[]])[] = [
  [
    'Show me my options for next term, no Fridays',
    [ToolName.ProposeConstraints, ToolName.RequestPlan],
  ],
  ['What are my options?', [ToolName.RequestPlan]],
  ['I cannot do Fridays', [ToolName.ProposeConstraints]],
  ['What is the policy on late drop?', [ToolName.SearchApprovedPolicy]],
  ['How do I withdraw from a class?', [ToolName.SearchApprovedPolicy]],
  ['I want to talk to an advisor about my plan', [ToolName.DraftCaseContext]],
  ['Please open a case', [ToolName.DraftCaseContext]],
  ['How much financial aid will I get?', []],
  ['hello there', []],
];

async function runTurn(text: string): Promise<{
  readonly calls: readonly string[];
  readonly first: ModelReply;
  readonly final: ModelReply;
}> {
  const model = createDemoModel();
  const first = await model.respond({
    system: 's',
    messages: [{ role: 'user', text }],
    tools: [],
  });
  const messages: ModelMessage[] = [
    { role: 'user', text },
    { role: 'assistant', text: first.text, toolCalls: first.toolCalls },
    ...first.toolCalls.map((call): ModelMessage => ({
      role: 'tool',
      toolCallId: call.id,
      toolName: call.name,
      content: '<untrusted-data/>',
    })),
  ];
  const final =
    first.toolCalls.length === 0
      ? first
      : await model.respond({ system: 's', messages, tools: [] });
  return { calls: first.toolCalls.map((call) => call.name), first, final };
}

describe('createDemoModel', () => {
  it.each(SCENARIOS)('%s calls the expected tools in order', async (text, tools) => {
    const { calls } = await runTurn(text);
    expect(calls).toEqual(tools);
  });

  it.each(SCENARIOS)('%s ends with an intro id that resolves cleanly', async (text, tools) => {
    const { final } = await runTurn(text);
    expect(final.toolCalls).toEqual([]);
    expect(final.stopReason).toBe('END_TURN');
    const kinds = tools
      .map((tool) => BLOCK_KIND_BY_TOOL[tool])
      .filter((kind) => kind !== undefined);
    const resolved = resolveIntro(final.text, kinds);
    expect(resolved.reasons).toEqual([]);
    expect(resolved.introId).toBe(final.text);
  });

  it('sends the aid question to the cannot-help intro with no tools', async () => {
    const { final } = await runTurn('Can I get a scholarship?');
    expect(final.text).toBe('CANNOT_HELP');
  });

  it('passes catalog argument validation', async () => {
    const { first } = await runTurn('options for next term, no Fridays');
    for (const call of first.toolCalls) {
      const schema = ALL_TOOLS.find((candidate) => candidate.name === call.name)?.argumentsSchema;
      expect(schema?.safeParse(call.arguments).success).toBe(true);
    }
  });

  it('never puts identity in tool arguments', async () => {
    for (const [text] of SCENARIOS) {
      const { first } = await runTurn(text);
      for (const call of first.toolCalls) {
        expect(JSON.stringify(call.arguments)).not.toMatch(/tenant|user|student/i);
      }
    }
  });

  it('gives identical replies for identical inputs', async () => {
    const a = await runTurn('options, no Fridays');
    const b = await runTurn('options, no Fridays');
    expect(a).toEqual(b);
  });

  describe('when request_plan returns only a notice', () => {
    async function finalIntro(content: string): Promise<string> {
      const model = createDemoModel();
      const text = 'Show me my options, no Fridays';
      const first = await model.respond({
        system: 's',
        messages: [{ role: 'user', text }],
        tools: [],
      });
      const messages: ModelMessage[] = [
        { role: 'user', text },
        { role: 'assistant', text: '', toolCalls: first.toolCalls },
        ...first.toolCalls.map((call): ModelMessage => ({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: call.name === ToolName.RequestPlan ? content : '<untrusted-data/>',
        })),
      ];
      return (await model.respond({ system: 's', messages, tools: [] })).text;
    }

    it('uses the constraint proposal intro, which resolves against the blocks returned', async () => {
      const intro = await finalIntro('{"plannerInputNeeded":true}');
      expect(intro).toBe('CONSTRAINT_PROPOSAL');
      const resolved = resolveIntro(intro, [AssistantBlockKind.ConstraintProposal]);
      expect(resolved.reasons).toEqual([]);
    });

    it('still uses the schedule options intro when options came back', async () => {
      expect(await finalIntro('{"options":[]}')).toBe('SCHEDULE_OPTIONS');
    });
  });
});
