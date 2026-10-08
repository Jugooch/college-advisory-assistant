/**
 * @file Tests of the turn service through the app with the scripted model: the rate limit and clear,
 * both crisis tiers, detector blocks at every status, and the model's history window.
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
  finalStep,
  INTRO_TEXTS,
  IntroId,
  scriptedToolCall,
  toolCallStep,
  ToolName,
} from '@caa/assistant';
import {
  AssistantBlockKind,
  AssistantTurnMetadataSchema,
  ModelStatus,
  NoticeCode,
  SpecialistTopic,
} from '@caa/domain';

import { setupTurnApp, TURN_TERM_ID } from '../../testing/conversation-turn-harness';
import { bearer, STUDENTS, TEST_NOW, TOKENS } from '../../testing/fixtures';

const summary = (id: string) => scriptedToolCall(id, ToolName.GetAcademicSummary);

describe('POST /v1/students/:studentId/conversation/turns', () => {
  it('is RATE_LIMITED past the limit, and the limit survives a clear', async () => {
    const { post, app, store, model } = setupTurnApp({
      steps: [finalStep(IntroId.AskForDetail), finalStep(IntroId.AskForDetail)],
      rateLimit: 2,
    });
    await post('one');
    await post('two');

    const cleared = await app.inject({
      method: 'DELETE',
      url: `/v1/students/${STUDENTS.own.id}/conversation?termId=${TURN_TERM_ID}`,
      headers: bearer(TOKENS.student),
    });
    const limited = await post('three', { expectedSequence: 0 });

    expect(cleared.statusCode).toBe(204);
    expect(limited.turn?.turn).toMatchObject({
      modelStatus: ModelStatus.RateLimited,
      sequence: null,
    });
    expect(limited.turn?.turn.blocks[0]).toMatchObject({ code: NoticeCode.RateLimited });
    expect(model?.remaining()).toBe(0);
    expect(store.conversationTurns).toEqual([]);
    expect(store.studentTurnLog).toHaveLength(2);
  });

  it('skips the model for tier-1 crisis, showing only the crisis referral', async () => {
    const { post, store, model } = setupTurnApp({ steps: [] });

    const { turn } = await post('I want to kill myself and my financial aid is late');

    expect(turn?.turn).toMatchObject({ modelStatus: ModelStatus.Guarded, intro: '', sequence: 2 });
    expect(turn?.turn.blocks).toHaveLength(1);
    expect(turn?.turn.blocks[0]).toMatchObject({
      kind: AssistantBlockKind.Referral,
      topic: SpecialistTopic.Crisis,
    });
    expect(model?.requests).toEqual([]);
    const metadata = AssistantTurnMetadataSchema.parse(store.conversationTurns?.[1]?.metadata);
    expect(metadata).toMatchObject({ modelId: null, guardReasons: ['CRISIS_UNAMBIGUOUS'] });
  });

  it('never replays a tier-1 exchange in later history', async () => {
    const { post, model } = setupTurnApp({ steps: [finalStep(IntroId.AskForDetail)] });
    await post('I want to kill myself');

    await post('What classes are open?');

    expect(model?.requests[0]?.messages).toEqual([
      { role: 'user', text: 'What classes are open?' },
    ]);
  });

  it('adds the crisis-support card first for tier 2 and still answers', async () => {
    const { post, model } = setupTurnApp({ steps: [finalStep(IntroId.AskForDetail)] });

    const { turn } = await post('I feel hopeless about my classes');

    expect(model?.requests).toHaveLength(1);
    expect(turn?.turn.modelStatus).toBe(ModelStatus.Answered);
    expect(turn?.turn.blocks[0]).toMatchObject({
      kind: AssistantBlockKind.Referral,
      topic: SpecialistTopic.Crisis,
      templateId: 'referral.crisis-support',
    });
  });

  it('shows detector blocks at RATE_LIMITED and DISABLED', async () => {
    const disabled = setupTurnApp();
    const limited = setupTurnApp({ steps: [], rateLimit: 1 });
    limited.store.studentTurnLog = [
      {
        tenantId: limited.conversation.tenantId,
        studentId: STUDENTS.own.id,
        createdAt: TEST_NOW.toISOString(),
      },
    ];

    const off = await disabled.post('I want to kill myself');
    const over = await limited.post('What if I pass? I need financial aid advice');

    expect(off.turn?.turn.blocks.map((block) => block.kind)).toEqual(['REFERRAL', 'NOTICE']);
    expect(off.turn?.turn.modelStatus).toBe(ModelStatus.Disabled);
    expect(over.turn?.turn.modelStatus).toBe(ModelStatus.RateLimited);
    expect(over.turn?.turn.blocks.map((block) => block.kind)).toEqual([
      'REFERRAL',
      'NOTICE',
      'NOTICE',
    ]);
  });

  it('sends the model only student messages and server intros, within the window', async () => {
    const { post, model } = setupTurnApp({
      steps: [
        toolCallStep(summary('a')),
        finalStep(IntroId.AcademicSummary),
        finalStep(IntroId.AskForDetail),
        finalStep(IntroId.AskForDetail),
      ],
      historyTurns: 2,
    });
    await post('first question');
    await post('second question');

    await post('third question');

    const sent = model?.requests.at(-1)?.messages;
    expect(sent).toEqual([
      { role: 'user', text: 'second question' },
      { role: 'assistant', text: INTRO_TEXTS[IntroId.AskForDetail], toolCalls: [] },
      { role: 'user', text: 'third question' },
    ]);
  });
});
