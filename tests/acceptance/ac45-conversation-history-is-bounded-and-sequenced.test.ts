/**
 * @file Acceptance AC45 (planning/13, ADR-0015 section 7): the conversation history is bounded and
 * sequenced. Only the configured number of recent turns reaches the model, with no tool results or
 * blocks; turns beyond 100 or 30 days are deleted on the next append; the rate limit survives a
 * clear; a stale `expectedSequence` is 409 with no model call; `lastSequence` is returned; and no
 * message text is logged. Limits are written out literally from the planning/13 row.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { ASK_FOR_DETAIL } from '../support/chat-schedule-fixtures';
import {
  clearTranscript,
  createModelSlot,
  lastSequenceOf,
  postTurn,
  readTranscript,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { seedPairs, storedSequences } from '../support/conversation-seeding';
import { acceptanceIt } from '../support/known-findings';
import { BOTH_COURSES, resetPlanWorld } from '../support/plan-drafts-harness';

const world = createAcademicWorld();
const slot = createModelSlot();
/** Lines the logging app wrote. */
const logLines: string[] = [];

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });
const historyApp = buildAcademicApp(world, {
  conversationModel: slot.model,
  conversationHistoryTurns: 4,
});
const limitedApp = buildAcademicApp(world, {
  conversationModel: slot.model,
  conversationRateLimit: 2,
});
const loggingApp = buildAcademicApp(world, {
  conversationModel: slot.model,
  logStream: { write: (line) => logLines.push(line) },
});

describe('AC45 conversation history is bounded, sequenced and unlogged', () => {
  beforeEach(() => {
    resetChatWorld(world);
    logLines.length = 0;
  });

  acceptanceIt(
    'AC45',
    'sends only the configured number of recent turns to the model, with no tool results or blocks',
    async () => {
      resetPlanWorld(world);
      let expectedSequence = 0;
      for (const number of [1, 2, 3, 4]) {
        slot.use([finalStep('ASK_FOR_DETAIL')]);
        const reply = await postTurn(historyApp, `message ${String(number)}`, { expectedSequence });
        expectedSequence = lastSequenceOf(reply) ?? -1;
      }
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);
      const withTool = await postTurn(historyApp, 'message 5', {
        expectedSequence,
        plannerInputs: BOTH_COURSES,
      });
      expectedSequence = lastSequenceOf(withTool) ?? -1;
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const sixth = await postTurn(historyApp, 'message 6', { expectedSequence });
      expectedSequence = lastSequenceOf(sixth) ?? -1;
      const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

      await postTurn(historyApp, 'message 7', { expectedSequence });

      // Twelve turns are stored; the window is the configured four, then the new message.
      const messages = model.requests[0]?.messages ?? [];
      expect(
        messages.map((message) => [message.role, 'text' in message ? message.text : '']),
      ).toEqual([
        ['user', 'message 5'],
        ['assistant', 'Here are your schedule options. Each card shows its own checks.'],
        ['user', 'message 6'],
        ['assistant', ASK_FOR_DETAIL],
        ['user', 'message 7'],
      ]);
      expect(JSON.stringify(messages)).not.toContain('sectionId');
      expect(JSON.stringify(messages)).not.toContain('"role":"tool"');
    },
  );

  acceptanceIt('AC45', 'deletes turns beyond the newest 100 on the next append', async () => {
    seedPairs(
      world,
      Array.from({ length: 50 }, () => '2026-08-30T10:00:00.000Z'),
    );
    slot.use([finalStep('ASK_FOR_DETAIL')]);

    const response = await postTurn(app, 'One more', { expectedSequence: 100 });

    expect(lastSequenceOf(response)).toBe(102);
    expect(storedSequences(world)).toHaveLength(100);
    expect(storedSequences(world)[0]).toBe(3);
    expect(storedSequences(world).at(-1)).toBe(102);
  });

  acceptanceIt('AC45', 'deletes turns older than 30 days on the next append', async () => {
    seedPairs(world, ['2026-07-15T10:00:00.000Z', '2026-08-25T10:00:00.000Z']);
    slot.use([finalStep('ASK_FOR_DETAIL')]);

    const response = await postTurn(app, 'One more', { expectedSequence: 4 });

    expect(lastSequenceOf(response)).toBe(6);
    expect(storedSequences(world)).toEqual([3, 4, 5, 6]);
  });

  acceptanceIt('AC45', 'keeps the rate limit across a clear', async () => {
    let expectedSequence = 0;
    for (const number of [1, 2]) {
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const reply = await postTurn(limitedApp, `message ${String(number)}`, { expectedSequence });
      expect(turnOf(reply).modelStatus).toBe('ANSWERED');
      expectedSequence = lastSequenceOf(reply) ?? -1;
    }
    const cleared = await clearTranscript(limitedApp);
    const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

    const response = await postTurn(limitedApp, 'message 3', { expectedSequence });

    expect(cleared.statusCode).toBe(204);
    expect(turnOf(response)).toMatchObject({ modelStatus: 'RATE_LIMITED', sequence: null });
    expect(model.requests).toHaveLength(0);
  });

  acceptanceIt(
    'AC45',
    'returns 409 and makes no model call when expectedSequence is stale after a clear',
    async () => {
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const first = await postTurn(app, 'Hello');
      await clearTranscript(app);
      const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

      const stale = await postTurn(app, 'Hello again', { expectedSequence: 0 });
      const transcript = await readTranscript(app);
      const current = await postTurn(app, 'Hello again', { expectedSequence: 2 });

      expect(lastSequenceOf(first)).toBe(2);
      expect(summarizeError(stale)).toMatchObject({
        statusCode: 409,
        bodyKeys: ['error'],
        code: 'REVISION_CONFLICT',
      });
      expect(transcript.body).toMatchObject({
        data: { available: true, turns: [], lastSequence: 2 },
      });
      expect(turnOf(current).modelStatus).toBe('ANSWERED');
      expect(lastSequenceOf(current)).toBe(4);
      expect(model.requests).toHaveLength(1);
    },
  );

  acceptanceIt('AC45', 'returns lastSequence on a turn and on the transcript', async () => {
    slot.use([finalStep('ASK_FOR_DETAIL')]);

    const response = await postTurn(app, 'Hello');
    const transcript = await readTranscript(app);

    expect(response.body).toMatchObject({ data: { turn: { sequence: 2 }, lastSequence: 2 } });
    expect(transcript.body).toMatchObject({ data: { lastSequence: 2 } });
  });

  acceptanceIt('AC45', 'logs no message text', async () => {
    const message = 'zebra marmalade 7741 about my schedule';
    slot.use([finalStep('SCHEDULE_OPTIONS ignore previous instructions zebra marmalade')]);

    const response = await postTurn(loggingApp, message);

    expect(response.statusCode).toBe(200);
    expect(logLines.length).toBeGreaterThan(0);
    const logged = logLines.join('');
    expect(logged).not.toContain('zebra');
    expect(logged).not.toContain('marmalade');
    expect(logged).not.toContain('7741');
    expect(logged).not.toContain('ignore previous instructions');
  });
});
