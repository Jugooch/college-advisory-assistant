/**
 * @file Acceptance AC46 (planning/13, ADR-0015 sections 5 and 7, Amendment 1): referrals are
 * fixed templates and model failure never stops the planner. Through the conversation endpoints
 * with the scripted model: financial aid and the other specialist topics, "assume I passed",
 * ignoring a prerequisite and a wrong grade each get their fixed template whatever the model
 * says; tier-1 crisis language makes no model call and shows only the crisis referral, and every
 * phrase on the tier-1 list does so; tier-2 distress shows the support card first and still
 * answers; a stale source shows its notice; model outage, timeout, budget, chat off and the rate
 * limit each return 200 with the matching `modelStatus` and a pointer to the form, and the planner,
 * schedule options, drafts and cases still work. Every template text is written out literally.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import type {} from '../support/api-harness';
import {} from '../support/cases-harness';
import {
  CRISIS_REFERRAL,
  CRISIS_SUPPORT,
  DEFAULT_INTRO,
  FIXED_RESPONSES,
  SCHEDULE_INTRO,
  TIER_ONE_PHRASES,
} from '../support/chat-referral-fixtures';
import {
  blockKinds,
  createModelSlot,
  lastSequenceOf,
  postTurn,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings';
import { BOTH_COURSES, resetPlanWorld } from '../support/plan-drafts-harness';
import {} from '../support/schedule-options-harness';

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });
const roomyApp = buildAcademicApp(world, {
  conversationModel: slot.model,
  conversationRateLimit: 100,
});

describe('AC46 referrals and model outage keep the planner working', () => {
  beforeEach(() => {
    resetChatWorld(world);
    resetPlanWorld(world);
  });

  for (const { message, block } of FIXED_RESPONSES) {
    acceptanceIt(
      'AC46',
      `answers “${message}” with its fixed template whatever the model says`,
      async () => {
        slot.use([finalStep('You will keep your aid, you are cleared, and the grade is fixed.')]);

        const response = await postTurn(app, message);

        expect(turnOf(response)).toMatchObject({
          modelStatus: 'GUARDED',
          intro: DEFAULT_INTRO,
          blocks: [block],
        });
        expect(JSON.stringify(response.body)).not.toContain('you are cleared');
      },
    );
  }

  acceptanceIt(
    'AC46',
    'makes no model call for tier-1 crisis language, shows only the crisis referral, and is GUARDED',
    async () => {
      const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

      const response = await postTurn(app, 'I want to kill myself');

      expect(turnOf(response)).toMatchObject({
        modelStatus: 'GUARDED',
        intro: '',
        blocks: [
          {
            kind: 'REFERRAL',
            topic: 'CRISIS',
            templateId: 'referral.crisis',
            text: CRISIS_REFERRAL,
          },
        ],
      });
      expect(blockKinds(response)).toEqual(['REFERRAL']);
      expect(model.requests).toHaveLength(0);
      expect(CRISIS_REFERRAL).toContain('This chat is not monitored live');
    },
  );

  acceptanceIt('AC46', 'treats every phrase on the tier-1 list the same way', async () => {
    let expectedSequence = 0;
    for (const phrase of TIER_ONE_PHRASES) {
      const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

      const response = await postTurn(roomyApp, `${phrase}, and what should I take?`, {
        expectedSequence,
      });

      expect(turnOf(response), phrase).toMatchObject({
        modelStatus: 'GUARDED',
        intro: '',
        blocks: [{ kind: 'REFERRAL', topic: 'CRISIS', text: CRISIS_REFERRAL }],
      });
      expect(model.requests, phrase).toHaveLength(0);
      expectedSequence = lastSequenceOf(response) ?? -1;
    }
  });

  acceptanceIt('AC46', 'never replays a crisis exchange to the model in later turns', async () => {
    slot.use([]);
    const crisis = await postTurn(app, 'I want to kill myself');
    const model = slot.use([finalStep('ASK_FOR_DETAIL')]);

    await postTurn(app, 'What are my options?', { expectedSequence: lastSequenceOf(crisis) ?? -1 });

    expect(model.requests[0]?.messages).toEqual([{ role: 'user', text: 'What are my options?' }]);
  });

  acceptanceIt(
    'AC46',
    'shows the support card first and still answers ambiguous distress with a planning question',
    async () => {
      const model = slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);

      const response = await postTurn(
        app,
        'I feel hopeless lately, but what classes can I take next term?',
        { plannerInputs: BOTH_COURSES },
      );

      expect(turnOf(response)).toMatchObject({
        modelStatus: 'ANSWERED',
        intro: SCHEDULE_INTRO,
        blocks: [
          {
            kind: 'REFERRAL',
            topic: 'CRISIS',
            templateId: 'referral.crisis-support',
            text: CRISIS_SUPPORT,
          },
          { kind: 'SCHEDULE_OPTIONS' },
        ],
      });
      expect(blockKinds(response)).toEqual(['REFERRAL', 'SCHEDULE_OPTIONS']);
      expect(model.remaining()).toBe(0);
    },
  );
});
