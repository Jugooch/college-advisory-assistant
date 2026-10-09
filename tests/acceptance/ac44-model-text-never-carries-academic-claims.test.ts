/**
 * @file Acceptance AC44 (planning/13, ADR-0015 Amendment 1): no model-written text reaches the
 * student. Through `POST /v1/students/:studentId/conversation/turns` with the scripted model:
 * the intro is always a fixed server sentence, the model's choice only when its reply is exactly
 * a valid intro id for the turn's blocks, and otherwise the default intro with the turn GUARDED;
 * cards are exactly this turn's tool results; and a case preview's note starts empty. Every
 * expected sentence is written out literally from the intro templates, never computed by
 * production logic.
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, MisbehavingStep, scriptedToolCall, toolCallStep } from '@caa/assistant';
import { SYNTHETIC_COURSES } from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import {
  ACADEMIC_SUMMARY_INTRO,
  ASK_FOR_DETAIL,
  MATH_MWF,
  MATH_TTH,
  SCHEDULE_INTRO,
} from '../support/chat-schedule-fixtures';
import {
  blockKinds,
  createModelSlot,
  postTurn,
  readTranscript,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import { publishSections, scheduleRequest } from '../support/schedule-options-harness';

const { math102 } = SYNTHETIC_COURSES;
const FORM = scheduleRequest([math102.id]);

/** Replies that state a consequential fact, each one a model reply a student must never see. */
const CLAIM_REPLIES = [
  'You have 12 credits this term.',
  'Your grade in MATH 101 is a B.',
  'You are eligible for MATH 102.',
  'The withdrawal deadline is October 30.',
  'You are ready to graduate.',
  'You are registered for MATH 102.',
] as const;

const requestPlan = toolCallStep(scriptedToolCall('call-1', 'request_plan', {}));

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });

describe('AC44 model text never carries academic claims', () => {
  beforeEach(() => {
    resetChatWorld(world);
    publishSections(world, [MATH_MWF, MATH_TTH]);
  });

  acceptanceIt(
    'AC44',
    'shows the fixed intro, and no model text, when the model names a valid intro id',
    async () => {
      slot.use([requestPlan, finalStep('SCHEDULE_OPTIONS')]);

      const response = await postTurn(app, 'Show me options', { plannerInputs: FORM });

      expect(turnOf(response)).toMatchObject({
        modelStatus: 'ANSWERED',
        intro: SCHEDULE_INTRO,
      });
      expect(blockKinds(response)).toEqual(['SCHEDULE_OPTIONS']);
    },
  );

  acceptanceIt(
    'AC44',
    'replaces prose stating credits, a grade, eligibility, a deadline, readiness or registered with the default intro and GUARDED',
    async () => {
      let expectedSequence = 0;
      for (const claim of CLAIM_REPLIES) {
        slot.use([finalStep(claim)]);

        const response = await postTurn(app, 'How am I doing?', { expectedSequence });

        expect(turnOf(response)).toMatchObject({
          modelStatus: 'GUARDED',
          intro: ASK_FOR_DETAIL,
          blocks: [],
        });
        expect(JSON.stringify(response.body)).not.toContain(claim);
        expectedSequence += 2;
      }

      const transcript = await readTranscript(app);
      expect(JSON.stringify(transcript.body)).not.toContain('credits this term');
      expect(JSON.stringify(transcript.body)).not.toContain('eligible');
      expect(JSON.stringify(transcript.body)).not.toContain('ready to graduate');
    },
  );

  acceptanceIt(
    'AC44',
    'gives the default intro and GUARDED for prose, an id wrapped in a claim, and an unknown id',
    async () => {
      const misbehaving = [
        MisbehavingStep.proseInsteadOfIntro,
        MisbehavingStep.consequentialText,
        MisbehavingStep.unknownIntroId,
        MisbehavingStep.obeysInjectedText,
      ];
      let expectedSequence = 0;
      for (const step of misbehaving) {
        slot.use([step]);

        const response = await postTurn(app, 'Hello', { expectedSequence });

        expect(turnOf(response)).toMatchObject({
          modelStatus: 'GUARDED',
          intro: ASK_FOR_DETAIL,
          blocks: [],
        });
        expect(JSON.stringify(response.body)).not.toContain(step.text);
        expectedSequence += 2;
      }
    },
  );

  acceptanceIt(
    'AC44',
    'gives the data intro of the cards shown, and GUARDED, when the model names an intro whose block the turn lacks',
    async () => {
      slot.use([requestPlan, finalStep('POLICY_RESULTS')]);

      const response = await postTurn(app, 'Show me options', { plannerInputs: FORM });

      expect(turnOf(response)).toMatchObject({ modelStatus: 'GUARDED', intro: SCHEDULE_INTRO });
      expect(blockKinds(response)).toEqual(['SCHEDULE_OPTIONS']);
    },
  );

  acceptanceIt(
    'AC44',
    'renders no block without a tool result, even when the model refers to a plan or a policy',
    async () => {
      slot.use([MisbehavingStep.introWithoutBlock]);
      const policy = await postTurn(app, 'What does the policy say?');
      slot.use([finalStep('PLAN_EVIDENCE')]);
      const plan = await postTurn(app, 'Show my plan', { expectedSequence: 2 });
      slot.use([finalStep('CASE_PREVIEW')]);
      const caseDraft = await postTurn(app, 'Ask my advisor', { expectedSequence: 4 });

      for (const response of [policy, plan, caseDraft]) {
        expect(turnOf(response)).toMatchObject({
          modelStatus: 'GUARDED',
          intro: ASK_FOR_DETAIL,
          blocks: [],
        });
      }
    },
  );

  acceptanceIt(
    'AC44',
    'shows exactly this turn’s results and none from an earlier turn',
    async () => {
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'get_academic_summary', {})),
        finalStep('ACADEMIC_SUMMARY'),
      ]);
      const first = await postTurn(app, 'How am I doing on requirements?');
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const second = await postTurn(app, 'Thanks', { expectedSequence: 2 });

      expect(blockKinds(first)).toEqual(['ACADEMIC_SUMMARY']);
      expect(turnOf(first).intro).toBe(ACADEMIC_SUMMARY_INTRO);
      expect(turnOf(second)).toMatchObject({
        modelStatus: 'ANSWERED',
        intro: ASK_FOR_DETAIL,
        blocks: [],
      });
    },
  );

  acceptanceIt('AC44', 'starts a case preview’s note empty', async () => {
    slot.use([
      toolCallStep(
        scriptedToolCall('call-1', 'draft_case_context', {
          reason: 'SOURCE_DISCREPANCY',
          discrepancySubject: 'COURSE_ATTEMPT',
        }),
      ),
      finalStep('CASE_PREVIEW'),
    ]);

    const response = await postTurn(app, 'Ask my advisor to look at my grade');

    expect(turnOf(response)).toMatchObject({
      modelStatus: 'ANSWERED',
      intro: 'Here is a preview of the case. Nothing is sent until you confirm it.',
      blocks: [
        {
          kind: 'CASE_PREVIEW',
          reason: 'SOURCE_DISCREPANCY',
          planId: null,
          planRevision: null,
          discrepancySubject: 'COURSE_ATTEMPT',
          suggestedNote: '',
        },
      ],
    });
  });
});
