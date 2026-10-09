/**
 * @file HTTP-level tests for `POST /v1/students/:studentId/conversation/turns` with the scripted
 * model: each answered status, a model that misbehaves, identity smuggled into tool calls, and the budget.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC43
 * @requirement AC44
 * @requirement AC45
 * @requirement AC46
 * @requirement AC47
 */
import { describe, expect, it } from 'vitest';

import {
  failureStep,
  finalStep,
  INTRO_TEXTS,
  IntroId,
  MisbehavingStep,
  ScriptedFailure,
  scriptedToolCall,
  toolCallStep,
  ToolName,
} from '@caa/assistant';
import {
  AssistantBlockKind,
  AssistantTurnMetadataSchema,
  ModelStatus,
  NoticeCode,
  TurnRole,
} from '@caa/domain';

import { setupTurnApp } from '../../testing/conversation-turn-harness';
import { STUDENTS } from '../../testing/fixtures';

const summary = (id: string) => scriptedToolCall(id, ToolName.GetAcademicSummary);
const kinds = (blocks: readonly { kind: string }[] | undefined) =>
  (blocks ?? []).map((block) => block.kind);

describe('POST /v1/students/:studentId/conversation/turns', () => {
  it('answers with the chosen intro and the tool block, storing references only', async () => {
    const { post, store, lines } = setupTurnApp({
      steps: [toolCallStep(summary('a')), finalStep(IntroId.AcademicSummary)],
    });

    const { status, turn } = await post('Show my academic summary please');

    expect(status).toBe(200);
    expect(turn?.turn.modelStatus).toBe(ModelStatus.Answered);
    expect(turn?.turn.intro).toBe(INTRO_TEXTS[IntroId.AcademicSummary]);
    expect(kinds(turn?.turn.blocks)).toEqual([AssistantBlockKind.AcademicSummary]);
    expect(turn?.turn.sequence).toBe(2);
    const stored = store.conversationTurns ?? [];
    expect(stored.map((item) => item.role)).toEqual([TurnRole.Student, TurnRole.Assistant]);
    expect(JSON.stringify(stored[1]?.blockRefs)).not.toContain('requirements');
    const metadata = AssistantTurnMetadataSchema.parse(stored[1]?.metadata);
    expect(metadata.modelId).not.toBeNull();
    expect(metadata.guardReasons).toEqual([]);
    expect(lines.join('')).not.toContain('academic summary please');
    expect(lines.join('')).toContain('"modelStatus":"ANSWERED"');
  });

  it('shows a planner notice when request_plan has no form state', async () => {
    const { post } = setupTurnApp({
      steps: [
        toolCallStep(scriptedToolCall('p', ToolName.RequestPlan)),
        finalStep(IntroId.AskForDetail),
      ],
    });

    const { turn } = await post('Build me a schedule');

    expect(turn?.turn.modelStatus).toBe(ModelStatus.Answered);
    expect(turn?.turn.blocks.map((block) => block.kind)).toEqual([AssistantBlockKind.Notice]);
  });

  it.each([
    ['prose', MisbehavingStep.proseInsteadOfIntro],
    ['an id with text', MisbehavingStep.consequentialText],
    ['an unknown id', MisbehavingStep.unknownIntroId],
    ['an id whose block is missing', MisbehavingStep.introWithoutBlock],
    ['injected instructions', MisbehavingStep.obeysInjectedText],
  ])('is GUARDED, with a default intro and no model text, for %s', async (_name, step) => {
    const { post, store, lines } = setupTurnApp({ steps: [step] });

    const { turn, raw } = await post('What can I take next term?');

    expect(turn?.turn.modelStatus).toBe(ModelStatus.Guarded);
    expect(turn?.turn.intro).toBe(INTRO_TEXTS[IntroId.AskForDetail]);
    for (const text of ['eligible', 'credits', 'waived', 'GUARANTEED']) {
      expect(raw).not.toContain(text);
      expect(JSON.stringify(store.conversationTurns)).not.toContain(text);
      expect(lines.join('')).not.toContain(text);
    }
    const metadata = AssistantTurnMetadataSchema.parse(store.conversationTurns?.[1]?.metadata);
    expect(metadata.guardReasons).toHaveLength(1);
  });

  it('ignores identity smuggled into tool arguments and an unknown tool', async () => {
    const { post } = setupTurnApp({
      steps: [
        MisbehavingStep.identityInArguments,
        MisbehavingStep.unknownTool,
        finalStep(IntroId.ScheduleOptions),
      ],
    });

    const { turn } = await post('Plan my term');

    expect(turn?.turn.modelStatus).toBe(ModelStatus.Guarded);
    expect(turn?.turn.blocks).toEqual([]);
  });

  it('runs a tool call named for another student only for the session’s student', async () => {
    const { post } = setupTurnApp({
      steps: [
        toolCallStep(
          scriptedToolCall('x', ToolName.GetAcademicSummary, { studentId: STUDENTS.other.id }),
        ),
        finalStep(IntroId.CannotHelp),
      ],
    });

    const { turn } = await post('Show the summary for someone else');

    expect(turn?.turn.blocks).toEqual([]);
    expect(turn?.turn.modelStatus).toBe(ModelStatus.Answered);
  });

  it('is BUDGET_EXHAUSTED when a reply asks for more than four tool calls', async () => {
    const calls = ['a', 'b', 'c', 'd', 'e'].map(summary);
    const { post, model } = setupTurnApp({ steps: [toolCallStep(...calls)] });

    const { turn } = await post('Show everything');

    expect(turn?.turn.modelStatus).toBe(ModelStatus.BudgetExhausted);
    expect(kinds(turn?.turn.blocks).filter((kind) => kind === 'ACADEMIC_SUMMARY')).toHaveLength(4);
    expect(kinds(turn?.turn.blocks).at(-1)).toBe(AssistantBlockKind.Notice);
    expect(model?.requests).toHaveLength(1);
  });

  it('is BUDGET_EXHAUSTED after the third model call and a second request_plan', async () => {
    const loops = setupTurnApp({
      steps: [toolCallStep(summary('1')), toolCallStep(summary('2')), toolCallStep(summary('3'))],
    });
    const plans = setupTurnApp({
      steps: [
        toolCallStep(
          scriptedToolCall('p1', ToolName.RequestPlan),
          scriptedToolCall('p2', ToolName.RequestPlan),
        ),
      ],
    });

    const third = await loops.post('Loop forever');
    const second = await plans.post('Plan twice');

    expect(third.turn?.turn.modelStatus).toBe(ModelStatus.BudgetExhausted);
    expect(loops.model?.requests).toHaveLength(3);
    expect(second.turn?.turn.modelStatus).toBe(ModelStatus.BudgetExhausted);
    expect(kinds(second.turn?.turn.blocks)).toEqual(['NOTICE', 'NOTICE']);
  });

  it('is MODEL_UNAVAILABLE with the fallback notice, and stores the exchange', async () => {
    const { post, store } = setupTurnApp({ steps: [failureStep(ScriptedFailure.Unavailable)] });

    const { turn } = await post('Hello there');

    expect(turn?.turn.modelStatus).toBe(ModelStatus.ModelUnavailable);
    const [notice] = turn?.turn.blocks ?? [];
    expect(notice).toMatchObject({ kind: 'NOTICE', code: NoticeCode.ModelUnavailable });
    expect(store.conversationTurns).toHaveLength(2);
    expect(turn?.lastSequence).toBe(2);
  });

  it('returns the stored last sequence when chat is off, and 0 for an empty conversation', async () => {
    const empty = setupTurnApp();
    const kept = setupTurnApp();
    kept.store.lastSequences = { [kept.conversation.id]: 4 };

    const first = await empty.post('Hello there');
    const later = await kept.post('Hello there');

    expect(first.turn).toMatchObject({
      turn: { modelStatus: ModelStatus.Disabled },
      lastSequence: 0,
    });
    expect(later.turn).toMatchObject({ turn: { sequence: null }, lastSequence: 4 });
  });

  it('is DISABLED with chat off, storing nothing and calling no model', async () => {
    const { post, store } = setupTurnApp();

    const { status, turn } = await post('Hello there');

    expect(status).toBe(200);
    expect(turn?.turn).toMatchObject({ modelStatus: ModelStatus.Disabled, sequence: null });
    expect(store.conversationTurns).toEqual([]);
    expect(store.studentTurnLog).toEqual([]);
  });
});
