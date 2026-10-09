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
import { z } from 'zod';

import { ConversationResponseSchema } from '@caa/api-contract';
import {
  finalStep,
  INTRO_TEXTS,
  IntroId,
  scriptedToolCall,
  toolCallStep,
  ToolName,
} from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import {
  AssistantBlockKind,
  AssistantTurnMetadataSchema,
  ConversationTurnIdSchema,
  ModelStatus,
  NoticeCode,
  SpecialistTopic,
  TurnRole,
} from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

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
    const limited = await post('three');

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
    expect(turn?.lastSequence).toBe(2);
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

  it('does not let a stale expectedSequence run the model or dodge the rate limit', async () => {
    const { post, model, store } = setupTurnApp({
      steps: [finalStep(IntroId.AskForDetail), finalStep(IntroId.AskForDetail)],
      rateLimit: 2,
    });
    await post('one');

    const stale = await post('two', { expectedSequence: 999 });
    const second = await post('two');
    const limited = await post('three');

    expect(stale.status).toBe(409);
    expect(model?.requests).toHaveLength(2);
    expect(second.turn?.turn.modelStatus).toBe(ModelStatus.Answered);
    expect(limited.turn?.turn.modelStatus).toBe(ModelStatus.RateLimited);
    expect(store.studentTurnLog).toHaveLength(2);
  });

  it('keeps the last sequence through a clear, and GET shows it', async () => {
    const { post, app, store, conversation, model } = setupTurnApp({
      steps: [finalStep(IntroId.AskForDetail), finalStep(IntroId.AskForDetail)],
    });
    const sent = await post('one');
    const url = `/v1/students/${STUDENTS.own.id}/conversation?termId=${TURN_TERM_ID}`;
    const headers = bearer(TOKENS.student);

    await app.inject({ method: 'DELETE', url, headers });
    const read = await app.inject({ method: 'GET', url, headers });
    const staleAfterClear = await post('two', { expectedSequence: 0 });
    const afterClear = await post('two', { expectedSequence: 2 });

    expect(sent.turn?.lastSequence).toBe(2);
    expect(
      ConversationResponseSchema.parse(z.object({ data: z.unknown() }).parse(read.json()).data),
    ).toMatchObject({ turns: [], lastSequence: 2 });
    expect(staleAfterClear.status).toBe(409);
    expect(model?.requests).toHaveLength(2);
    expect(afterClear.turn).toMatchObject({ lastSequence: 4, turn: { sequence: 4 } });
    expect(store.lastSequences?.[conversation.id]).toBe(4);
  });

  it('refuses a stale sequence on a cleared conversation with no model call', async () => {
    const { post, app, model } = setupTurnApp({ steps: [finalStep(IntroId.AskForDetail)] });
    await post('one');
    await app.inject({
      method: 'DELETE',
      url: `/v1/students/${STUDENTS.own.id}/conversation?termId=${TURN_TERM_ID}`,
      headers: bearer(TOKENS.student),
    });

    const stale = await post('two', { expectedSequence: 0 });

    expect(stale.status).toBe(409);
    expect(model?.requests).toHaveLength(1);
    expect(model?.remaining()).toBe(0);
  });

  it('returns the last sequence on a rate-limited turn so the client can retry', async () => {
    const { post } = setupTurnApp({ steps: [finalStep(IntroId.AskForDetail)], rateLimit: 1 });
    await post('one');

    const limited = await post('two');

    expect(limited.turn).toMatchObject({
      turn: { modelStatus: ModelStatus.RateLimited },
      lastSequence: 2,
    });
  });

  describe('retention', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const seeded = (
      sequence: number,
      createdAt: string,
      conversationId: StoredConversationTurn['conversationId'],
    ): StoredConversationTurn => ({
      id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', sequence)),
      conversationId,
      sequence,
      role: TurnRole.Student,
      text: 'older',
      blockRefs: null,
      modelStatus: null,
      metadata: null,
      createdAt,
    });

    it('deletes turns older than 30 days on the next append and keeps newer ones', async () => {
      const { post, store, conversation } = setupTurnApp({
        steps: [finalStep(IntroId.AskForDetail)],
      });
      const old = new Date(TEST_NOW.getTime() - 30 * DAY_MS - 1000).toISOString();
      const recent = new Date(TEST_NOW.getTime() - 29 * DAY_MS).toISOString();
      store.conversationTurns = [
        seeded(1, old, conversation.id),
        seeded(2, recent, conversation.id),
      ];

      const { turn } = await post('new', { expectedSequence: 2 });

      expect(turn?.turn.sequence).toBe(4);
      expect(store.conversationTurns.map((stored) => stored.sequence)).toEqual([2, 3, 4]);
    });

    it('keeps only the newest 100 turns', async () => {
      const { post, store, conversation } = setupTurnApp({
        steps: [finalStep(IntroId.AskForDetail)],
      });
      store.conversationTurns = Array.from({ length: 100 }, (_, index) =>
        seeded(index + 1, TEST_NOW.toISOString(), conversation.id),
      );

      await post('new', { expectedSequence: 100 });

      expect(store.conversationTurns).toHaveLength(100);
      expect(store.conversationTurns[0]?.sequence).toBe(3);
      expect(store.conversationTurns.at(-1)?.sequence).toBe(102);
    });
  });
});
