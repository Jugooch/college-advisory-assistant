/**
 * @file Acceptance AC43 (planning/13): chat constraints apply only when confirmed. Through
 * `POST /v1/students/:studentId/conversation/turns` with the scripted model: a proposal from the
 * model arrives as a PREFERRED, unconfirmed chip and changes nothing; options before confirming
 * come from the form state alone; the form's own constraint, with the strength the student
 * chose, is what the options honour; and a hard Friday exclusion proves no plan instead of
 * relaxing. Expected sections and texts are written out literally from the planning/13 row and
 * ADR-0015 section 4, never computed by production logic.
 * @requirement FR-16
 * @requirement FR-08
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';
import { Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildUnavailableTime,
  HARD_STRENGTH,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { MATH_MWF, MATH_TTH, optionSections } from '../support/chat-schedule-fixtures';
import {
  blockKinds,
  createModelSlot,
  postTurn,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings';
import { publishSections, scheduleRequest } from '../support/schedule-options-harness';

const { math102 } = SYNTHETIC_COURSES;
/** DEMO-MATH 102 section 073: Friday only. */
const MATH_FRIDAY_ONLY = buildSection(
  { courseId: math102.id, meetings: [buildMeetingPattern({ weekdays: [Weekday.Friday] })] },
  73,
);
/** The planner form with the course chosen and no constraint. */
const FORM_NO_CONSTRAINTS = scheduleRequest([math102.id]);
/** The same form after the student confirmed "no Fridays" and kept it as a preference. */
const FORM_PREFERRED_NO_FRIDAYS = scheduleRequest([math102.id], [buildUnavailableTime()]);
/** The same form after the student switched the chip to hard and confirmed. */
const FORM_HARD_NO_FRIDAYS = scheduleRequest(
  [math102.id],
  [buildUnavailableTime({ ...HARD_STRENGTH })],
);

/** What the model proposes: it even asks for HARD, which the server must downgrade. */
const MODEL_PROPOSES_HARD_NO_FRIDAYS = toolCallStep(
  scriptedToolCall('call-1', 'propose_constraints', {
    constraints: [
      {
        kind: 'UNAVAILABLE_TIME',
        strength: 'HARD',
        priorityRank: null,
        weekdays: ['FRIDAY'],
        startTime: '00:00',
        endTime: '24:00',
      },
    ],
  }),
);

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });

describe('AC43 chat constraints apply only when confirmed', () => {
  beforeEach(() => {
    resetChatWorld(world);
    publishSections(world, [MATH_MWF, MATH_TTH]);
  });

  acceptanceIt(
    'AC43',
    'shows a no-Fridays proposal as a preferred, unconfirmed chip and applies nothing',
    async () => {
      const model = slot.use([MODEL_PROPOSES_HARD_NO_FRIDAYS, finalStep('CONSTRAINT_PROPOSAL')]);

      const response = await postTurn(app, "I'd like no Fridays");

      expect(response.statusCode).toBe(200);
      expect(turnOf(response)).toMatchObject({
        modelStatus: 'ANSWERED',
        intro: 'Here are the planning choices I understood. Please review them before continuing.',
        blocks: [
          {
            kind: 'CONSTRAINT_PROPOSAL',
            constraints: [
              {
                confirmed: false,
                constraint: {
                  kind: 'UNAVAILABLE_TIME',
                  strength: 'PREFERRED',
                  weekdays: ['FRIDAY'],
                  startTime: '00:00',
                  endTime: '24:00',
                },
              },
            ],
          },
        ],
      });
      expect(blockKinds(response)).toEqual(['CONSTRAINT_PROPOSAL']);
      expect(model.remaining()).toBe(0);
    },
  );

  acceptanceIt('AC43', 'computes options before confirming on the form state alone', async () => {
    const model = slot.use([
      toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
      finalStep('SCHEDULE_OPTIONS'),
    ]);

    const response = await postTurn(app, 'Show me options', {
      plannerInputs: FORM_NO_CONSTRAINTS,
    });

    expect(turnOf(response).modelStatus).toBe('ANSWERED');
    expect(blockKinds(response)).toEqual(['SCHEDULE_OPTIONS']);
    expect(optionSections(turnOf(response).blocks)).toEqual([[MATH_MWF.id], [MATH_TTH.id]]);
    expect(model.remaining()).toBe(0);
  });

  acceptanceIt(
    'AC43',
    'holds the constraint in the form with the strength the student chose, and options honour it',
    async () => {
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);
      const asHard = await postTurn(app, 'Show me options again', {
        plannerInputs: FORM_HARD_NO_FRIDAYS,
      });
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);
      const asPreferred = await postTurn(app, 'Show me options a third time', {
        plannerInputs: FORM_PREFERRED_NO_FRIDAYS,
        expectedSequence: 2,
      });

      expect(optionSections(turnOf(asHard).blocks)).toEqual([[MATH_TTH.id]]);
      expect(optionSections(turnOf(asPreferred).blocks)).toEqual([[MATH_MWF.id], [MATH_TTH.id]]);
      const hashOf = (response: typeof asHard) =>
        (turnOf(response).blocks[0]?.result as { pinnedInputs?: { constraintHash?: string } })
          .pinnedInputs?.constraintHash;
      expect(hashOf(asHard)).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(hashOf(asPreferred)).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(hashOf(asHard)).not.toBe(hashOf(asPreferred));
    },
  );

  acceptanceIt(
    'AC43',
    'proves no plan, rather than relaxing, when a hard Friday exclusion leaves no section',
    async () => {
      publishSections(world, [MATH_FRIDAY_ONLY]);
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);

      const response = await postTurn(app, 'Show me options', {
        plannerInputs: FORM_HARD_NO_FRIDAYS,
      });

      expect(turnOf(response).modelStatus).toBe('ANSWERED');
      expect(turnOf(response).blocks).toMatchObject([
        {
          kind: 'SCHEDULE_OPTIONS',
          result: {
            outcome: 'NO_FEASIBLE_PLAN',
            options: [],
            conflictSet: {
              items: [{ kind: 'SCHEDULE_FEASIBILITY', state: 'FAIL' }],
            },
          },
        },
      ]);
    },
  );
});
