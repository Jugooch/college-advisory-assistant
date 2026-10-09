/**
 * @file Acceptance AC44 (planning/13, ADR-0015 section 3): a stale or unreachable source shows its fixed
 * notice, and UNKNOWN and CONDITIONAL checks reach the student unchanged, never as PASS. Through
 * `POST /v1/students/:studentId/conversation/turns` with the scripted model; expected sentences
 * are written out literally from the notice templates.
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';
import {} from '@caa/domain';
import { buildAcademicPolicy, inProgressAttempt, SYNTHETIC_COURSES } from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import {
  MATH_MWF,
  MATH_TTH,
  optionsOf,
  PHYS_MWF,
  PHYS_TIME_REMOVED,
  STALE_NOTICE,
  UNAVAILABLE_NOTICE,
} from '../support/chat-schedule-fixtures';
import {
  blockKinds,
  createModelSlot,
  postTurn,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
const BOTH = scheduleRequest([math102.id, phys201.id]);
const FORM = scheduleRequest([math102.id]);

const requestPlan = toolCallStep(scriptedToolCall('call-1', 'request_plan', {}));

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model });

describe('AC44 stale sources and UNKNOWN or CONDITIONAL checks reach the student unchanged', () => {
  beforeEach(() => {
    resetChatWorld(world);
    publishSections(world, [MATH_MWF, MATH_TTH]);
  });

  acceptanceIt(
    'AC44',
    'shows the stale-source notice when the section snapshot is older than its limit',
    async () => {
      publishSections(world, [MATH_MWF, MATH_TTH], {
        sourceEffectiveAt: '2026-08-31T11:59:59.999Z',
      });
      slot.use([requestPlan, finalStep('CANNOT_HELP')]);

      const response = await postTurn(app, 'Show me options', { plannerInputs: FORM });

      expect(turnOf(response).blocks).toMatchObject([
        {
          kind: 'NOTICE',
          code: 'STALE_SOURCE',
          templateId: 'notice.stale-source',
          text: STALE_NOTICE,
        },
      ]);
      expect(blockKinds(response)).not.toContain('SCHEDULE_OPTIONS');
    },
  );

  acceptanceIt(
    'AC44',
    'shows the source-unavailable notice when the term has no published snapshot',
    async () => {
      world.sectionSnapshots = [];
      slot.use([requestPlan, finalStep('CANNOT_HELP')]);

      const response = await postTurn(app, 'Show me options', { plannerInputs: FORM });

      expect(turnOf(response).blocks).toMatchObject([
        {
          kind: 'NOTICE',
          code: 'SOURCE_UNAVAILABLE',
          templateId: 'notice.source-unavailable',
          text: UNAVAILABLE_NOTICE,
        },
      ]);
      expect(blockKinds(response)).not.toContain('SCHEDULE_OPTIONS');
    },
  );

  acceptanceIt('AC44', 'delivers UNKNOWN unchanged and never as PASS', async () => {
    publishSections(world, [MATH_MWF, MATH_TTH, PHYS_MWF, PHYS_TIME_REMOVED]);
    slot.use([requestPlan, finalStep('SCHEDULE_OPTIONS')]);

    const response = await postTurn(app, 'Show me options', { plannerInputs: BOTH });

    const unknown = optionsOf(turnOf(response).blocks).filter(
      (option) => option.scheduleFeasibility.state !== 'PASS',
    );
    expect(unknown).toMatchObject([
      {
        scheduleFeasibility: { state: 'UNKNOWN', reasonCode: 'MEETING_TIME_UNKNOWN' },
        aggregate: 'NEEDS_VERIFICATION',
      },
    ]);
  });

  acceptanceIt('AC44', 'delivers CONDITIONAL unchanged and never as PASS', async () => {
    resetScheduleWorld(world, { attempts: [inProgressAttempt()] });
    world.policies = [
      buildAcademicPolicy({
        termCreditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 1800 },
        allowsInProgressPrerequisites: true,
      }),
    ];
    publishSections(world, [MATH_MWF, MATH_TTH]);
    slot.use([requestPlan, finalStep('SCHEDULE_OPTIONS')]);

    const response = await postTurn(app, 'Show me options', { plannerInputs: FORM });

    const options = optionsOf(turnOf(response).blocks);
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.courseResults).toMatchObject([
        { prerequisite: { state: 'CONDITIONAL', reasonCode: 'IN_PROGRESS_MIN_GRADE' } },
      ]);
      expect(option.aggregate).toBe('CONDITIONAL');
    }
  });
});
