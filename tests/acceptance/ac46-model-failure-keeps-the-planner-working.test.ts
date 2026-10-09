/**
 * @file Acceptance AC46 (planning/13, ADR-0015 section 2): a stale source shows its notice, and
 * model outage, timeout, budget, chat off and the rate limit each return 200 with the matching
 * `modelStatus` and a pointer to the form, while the planner, schedule options, drafts and cases
 * still work. Every notice text is written out literally.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import {
  failureStep,
  finalStep,
  ScriptedFailure,
  scriptedToolCall,
  toolCallStep,
} from '@caa/assistant';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import type { AcceptanceApp } from '../support/api-harness';
import { openCase, resetCasesWorld } from '../support/cases-harness';
import { DEFAULT_INTRO, FORM_POINTER } from '../support/chat-referral-fixtures';
import {
  clearTranscript,
  createModelSlot,
  lastSequenceOf,
  postTurn,
  readTranscript,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings';
import { BOTH_COURSES, resetPlanWorld, saveDefaultOption } from '../support/plan-drafts-harness';
import { findScheduleOptions, publishSections } from '../support/schedule-options-harness';

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });
const offApp = buildAcademicApp(world);
const limitedApp = buildAcademicApp(world, {
  conversationModel: slot.model,
  conversationRateLimit: 1,
});

/**
 * Proves the planner, schedule options, a draft and a case still work.
 *
 * @param target - The app whose planner is used.
 */
async function expectPlannerWorks(target: AcceptanceApp): Promise<void> {
  resetCasesWorld(world);
  const options = await findScheduleOptions(target, BOTH_COURSES);
  const saved = await saveDefaultOption(target);
  const { created } = await openCase(target);
  expect(options).toMatchObject({ statusCode: 200, body: { data: { outcome: 'OPTIONS_FOUND' } } });
  expect(saved.statusCode).toBe(201);
  expect(created.statusCode).toBe(201);
}

describe('AC46 model failure keeps the planner working', () => {
  beforeEach(() => {
    resetChatWorld(world);
    resetPlanWorld(world);
  });

  acceptanceIt('AC46', 'shows the stale-source notice when a tool source is stale', async () => {
    publishSections(world, [], { sourceEffectiveAt: '2026-08-31T11:59:59.999Z' });
    slot.use([
      toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
      finalStep('CANNOT_HELP'),
    ]);

    const response = await postTurn(app, 'Show me options', { plannerInputs: BOTH_COURSES });

    expect(turnOf(response).blocks).toMatchObject([
      { kind: 'NOTICE', code: 'STALE_SOURCE', templateId: 'notice.stale-source' },
    ]);
  });

  acceptanceIt(
    'AC46',
    'returns 200 MODEL_UNAVAILABLE with a pointer to the form when the model is down',
    async () => {
      slot.use([failureStep(ScriptedFailure.Unavailable)]);

      const response = await postTurn(app, 'Show me options');

      expect(response.statusCode).toBe(200);
      expect(turnOf(response)).toMatchObject({
        modelStatus: 'MODEL_UNAVAILABLE',
        intro: DEFAULT_INTRO,
        blocks: [
          {
            kind: 'NOTICE',
            code: 'MODEL_UNAVAILABLE',
            text: `The assistant is unavailable right now. ${FORM_POINTER}`,
          },
        ],
      });
      await expectPlannerWorks(app);
    },
  );

  acceptanceIt(
    'AC46',
    'returns 200 MODEL_UNAVAILABLE with a pointer to the form when the model times out',
    async () => {
      slot.use([failureStep(ScriptedFailure.Timeout)]);

      const response = await postTurn(app, 'Show me options');

      expect(response.statusCode).toBe(200);
      expect(turnOf(response)).toMatchObject({
        modelStatus: 'MODEL_UNAVAILABLE',
        blocks: [{ kind: 'NOTICE', code: 'MODEL_UNAVAILABLE' }],
      });
      await expectPlannerWorks(app);
    },
  );

  acceptanceIt(
    'AC46',
    'returns 200 BUDGET_EXHAUSTED with a pointer to the form when the turn exceeds its budget',
    async () => {
      const summary = toolCallStep(scriptedToolCall('call-1', 'get_academic_summary', {}));
      slot.use([summary, summary, summary, summary, summary, summary]);

      const response = await postTurn(app, 'Tell me everything');

      expect(response.statusCode).toBe(200);
      expect(turnOf(response)).toMatchObject({
        modelStatus: 'BUDGET_EXHAUSTED',
        intro: 'Here is your academic summary, as shown on your record.',
      });
      expect(turnOf(response).blocks.at(-1)).toMatchObject({
        kind: 'NOTICE',
        code: 'BUDGET_EXHAUSTED',
        text: `The assistant has reached its usage limit for now. ${FORM_POINTER}`,
      });
      await expectPlannerWorks(app);
    },
  );

  acceptanceIt(
    'AC46',
    'returns 200 DISABLED with a pointer to the form, stores nothing, and still shows referrals, when chat is off',
    async () => {
      const response = await postTurn(offApp, 'Will my scholarship cover this?');
      const transcript = await readTranscript(offApp);

      expect(response.statusCode).toBe(200);
      expect(turnOf(response)).toMatchObject({
        modelStatus: 'DISABLED',
        sequence: null,
        blocks: [
          { kind: 'REFERRAL', topic: 'FINANCIAL_AID' },
          {
            kind: 'NOTICE',
            code: 'DISABLED',
            text: `The assistant is turned off for your institution. ${FORM_POINTER}`,
          },
        ],
      });
      expect(transcript.body).toMatchObject({
        data: { available: false, unavailableReason: 'DISABLED', turns: [] },
      });
      expect(world.conversationTurns).toEqual([]);
      await expectPlannerWorks(offApp);
    },
  );

  acceptanceIt(
    'AC46',
    'returns 200 RATE_LIMITED with a pointer to the form, makes no model call, and still shows crisis referrals',
    async () => {
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const first = await postTurn(limitedApp, 'Hello');
      const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

      const second = await postTurn(limitedApp, 'I feel hopeless', {
        expectedSequence: lastSequenceOf(first) ?? -1,
      });

      expect(turnOf(first).modelStatus).toBe('ANSWERED');
      expect(second.statusCode).toBe(200);
      expect(turnOf(second)).toMatchObject({
        modelStatus: 'RATE_LIMITED',
        sequence: null,
        blocks: [
          { kind: 'REFERRAL', topic: 'CRISIS' },
          {
            kind: 'NOTICE',
            code: 'RATE_LIMITED',
            text: 'You are sending messages quickly. Please wait a moment and try again.',
          },
        ],
      });
      expect(model.requests).toHaveLength(0);
      await clearTranscript(limitedApp);
      await expectPlannerWorks(limitedApp);
    },
  );
});
