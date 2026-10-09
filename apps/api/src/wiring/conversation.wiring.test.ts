/**
 * @file Tests of the wiring's model choice, through the built app: off, demo, and the test seam.
 * The production refusals are tested with the configuration in `config/env.test.ts`.
 * @requirement FR-01
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConversationResponseSchema } from '@caa/api-contract';
import { AssistantTurnMetadataSchema, ModelStatus, NoticeCode } from '@caa/domain';
import { SYNTHETIC_SCHEDULE_TERM } from '@caa/test-kit';

import { setupTurnApp } from '../testing/conversation-turn-harness';
import { bearer, STUDENTS, TOKENS } from '../testing/fixtures';

const modelIdOfStoredAnswer = (store: { conversationTurns?: readonly { metadata: unknown }[] }) =>
  AssistantTurnMetadataSchema.parse(store.conversationTurns?.[1]?.metadata).modelId;

describe('wireConversation model choice', () => {
  it('is off by default: status unavailable and turns DISABLED', async () => {
    const { app, post, store } = setupTurnApp();

    const status = await app.inject({
      method: 'GET',
      url: `/v1/students/${STUDENTS.own.id}/conversation?termId=${SYNTHETIC_SCHEDULE_TERM.termId}`,
      headers: bearer(TOKENS.student),
    });
    const { turn } = await post('Hello there');

    const body = ConversationResponseSchema.parse(
      z.object({ data: z.unknown() }).parse(status.json()).data,
    );
    expect(body.available).toBe(false);
    expect(body.unavailableReason).toBe(NoticeCode.Disabled);
    expect(turn?.turn.modelStatus).toBe(ModelStatus.Disabled);
    expect(store.conversationTurns).toEqual([]);
  });

  it('records the demo model id when configured to demo', async () => {
    const { post, store } = setupTurnApp({ mode: 'demo' });

    const { status } = await post('What can I take next term?');

    expect(status).toBe(200);
    expect(modelIdOfStoredAnswer(store)).toBe('demo-model');
  });

  it('records the injected model id, even with chat configured off', async () => {
    const { post, store } = setupTurnApp({ steps: [], mode: 'off' });

    const { status } = await post('What can I take next term?');

    expect(status).toBe(200);
    expect(modelIdOfStoredAnswer(store)).toBe('injected-test-model');
  });
});
