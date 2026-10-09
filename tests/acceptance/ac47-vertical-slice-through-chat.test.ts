/**
 * @file Acceptance AC47 (planning/13, planning/14 §First vertical slice): the demo through chat.
 * Runs the story for the synthetic slice student through `POST .../conversation/turns` with
 * `CONVERSATION_MODEL=demo`, so it proves what a live demo with no API key shows: a no-Fridays
 * proposal arrives PREFERRED and unconfirmed; confirmed planner inputs give verified options with
 * evidence; a policy question gives an approved excerpt; a financial aid question gives the
 * referral; an advisor request gives a case preview that submits nothing; and the student
 * creates the case through the existing case endpoint. Expected values are written out from
 * planning/13, planning/14 and ADR-0015, never computed by the code under test.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-12
 * @requirement FR-16
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/14-first-vertical-slice.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeAll, describe, expect } from 'vitest';

import {
  buildConversation,
  buildPolicyDocument,
  SYNTHETIC_COURSES,
  SYNTHETIC_SCHEDULE_TERM,
} from '@caa/test-kit';

import {
  ACADEMIC_STUDENT_ID,
  buildAcademicApp,
  createAcademicWorld,
} from '../support/academic-endpoints-harness';
import { postAs } from '../support/api-harness';
import {
  type CasesWorld,
  createCase,
  planReviewBody,
  resetCasesWorld,
} from '../support/cases-harness';
import {
  HARD_NO_FRIDAYS,
  MATH_FRIDAY,
  MATH_TTH_AM,
  MATH_TTH_LATE,
  PHYS_MW,
} from '../support/chat-slice-fixtures';
import { acceptanceIt } from '../support/known-findings';
import { dataOf, MATH_MWF, PHYS_TTH, saveDefaultOption } from '../support/plan-drafts-harness';
import { publishSections, scheduleRequest } from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;

const TERM_ID = SYNTHETIC_SCHEDULE_TERM.termId;

const world: CasesWorld = createAcademicWorld();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationMode: 'demo' });

/** Sequence of the last stored turn; each turn must send it as `expectedSequence`. */
let lastSequence = 0;
/** Every student message sent, to prove none reaches the case. */
const sentMessages: string[] = [];

/** The turn fields the steps read. */
interface TurnData {
  readonly turn: {
    readonly sequence: number | null;
    readonly intro: string;
    readonly modelStatus: string;
    readonly blocks: readonly Record<string, unknown>[];
  };
  readonly lastSequence: number;
}

/**
 * Sends one chat turn as the signed-in slice student.
 *
 * @param message - What the student types.
 * @param plannerInputs - The planner form's confirmed state, when the form holds any.
 * @returns The turn from a 200 response.
 */
async function say(message: string, plannerInputs?: object): Promise<TurnData> {
  sentMessages.push(message);
  const response = await postAs(app, {
    url: `/v1/students/${ACADEMIC_STUDENT_ID}/conversation/turns`,
    authorization: 'Bearer academic-student',
    payload: {
      termId: TERM_ID,
      message,
      expectedSequence: lastSequence,
      ...(plannerInputs === undefined ? {} : { plannerInputs }),
    },
  });
  expect(response.statusCode).toBe(200);
  const data = dataOf(response) as unknown as TurnData;
  lastSequence = data.lastSequence;
  return data;
}

describe('AC47 the first vertical slice through chat (planning/14)', () => {
  beforeAll(() => {
    resetCasesWorld(world);
    publishSections(world, [MATH_FRIDAY, MATH_TTH_AM, MATH_TTH_LATE, PHYS_MW]);
    world.conversations = [buildConversation()];
    world.conversationTurns = [];
    world.studentTurnLog = [];
    world.policyDocuments = [
      buildPolicyDocument({
        documentKey: 'course-drop',
        subjectKey: 'course-drop',
        revision: 3,
        title: 'Dropping a course',
        body: 'A student may drop a course before the posted drop deadline.',
        effectiveFrom: '2026-08-01T00:00:00.000-05:00',
      }),
    ];
  });

  acceptanceIt(
    'AC47',
    'step 1: next-term options with no Fridays gives a preferred, unconfirmed chip',
    async () => {
      const { turn } = await say('Show me my next-term options, no Fridays please');

      expect(turn.sequence).toBe(2);
      // NOTE: GUARDED because the demo picks the schedule intro while the form is still empty and
      // only a notice comes back; the server swaps in its default intro (tracked in #570).
      expect(turn.modelStatus).toBe('GUARDED');
      expect(turn.intro).toBe(
        'Here are the planning choices I understood. Please review them before continuing.',
      );
      expect(turn.blocks).toEqual([
        {
          kind: 'CONSTRAINT_PROPOSAL',
          constraints: [
            {
              constraint: {
                kind: 'UNAVAILABLE_TIME',
                strength: 'PREFERRED',
                priorityRank: 1,
                weekdays: ['FRIDAY'],
                startTime: '00:00',
                endTime: '24:00',
              },
              confirmed: false,
            },
          ],
        },
        expect.objectContaining({ kind: 'NOTICE', code: 'PLANNER_INPUT_NEEDED' }),
      ]);
    },
  );

  acceptanceIt(
    'AC47',
    'step 2: confirming it as hard and asking again gives two verified options with evidence',
    async () => {
      const inputs = scheduleRequest([math102.id, phys201.id], [HARD_NO_FRIDAYS]);
      const { turn } = await say('Show me my next-term options', inputs);

      expect(turn.sequence).toBe(4);
      expect(turn.modelStatus).toBe('ANSWERED');
      expect(turn.intro).toBe('Here are your schedule options. Each card shows its own checks.');
      expect(turn.blocks).toHaveLength(1);
      const block = turn.blocks[0] as {
        kind: string;
        result: { outcome: string; options: readonly Record<string, unknown>[] };
      };
      expect(block.kind).toBe('SCHEDULE_OPTIONS');
      expect(block.result.outcome).toBe('OPTIONS_FOUND');
      expect(block.result.options).toMatchObject([
        { rank: 1, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
        { rank: 2, scheduleFeasibility: { state: 'PASS' }, aggregate: 'VALIDATED' },
      ]);
      const sectionSets = block.result.options.map((option) =>
        (option.bundles as readonly { sections: readonly { sectionId: string }[] }[])
          .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
          .sort(),
      );
      expect(sectionSets).toEqual([
        [MATH_TTH_AM.id, PHYS_MW.id].sort(),
        [MATH_TTH_LATE.id, PHYS_MW.id].sort(),
      ]);
      expect(JSON.stringify(block)).not.toContain(MATH_FRIDAY.id);
    },
  );

  acceptanceIt(
    'AC47',
    'step 3: a policy question gives an approved excerpt with its revision and effective dates',
    async () => {
      const { turn } = await say('What is the policy on dropping a course?');

      expect(turn.sequence).toBe(6);
      expect(turn.modelStatus).toBe('ANSWERED');
      expect(turn.intro).toBe('Here are the policy documents that match your question.');
      expect(turn.blocks).toMatchObject([
        {
          kind: 'POLICY_RESULTS',
          results: {
            hits: [
              {
                documentKey: 'course-drop',
                revision: 3,
                title: 'Dropping a course',
                excerpt: 'A student may drop a course before the posted drop deadline.',
                effectiveFrom: '2026-08-01T00:00:00.000-05:00',
                effectiveTo: null,
                sourceLabel: 'Demo State University Registrar Handbook',
                conflict: false,
              },
            ],
          },
        },
      ]);
    },
  );

  acceptanceIt(
    'AC47',
    'step 4: a financial-aid question gives the referral with no determination',
    async () => {
      const { turn } = await say('Will financial aid cover this schedule?');

      expect(turn.sequence).toBe(8);
      expect(turn.modelStatus).toBe('ANSWERED');
      expect(turn.intro).toBe(
        'I cannot help with that here. You can use the planning form, open My plans, or go to Help and cases.',
      );
      expect(turn.blocks).toMatchObject([
        {
          kind: 'REFERRAL',
          topic: 'FINANCIAL_AID',
          templateId: 'referral.financial-aid',
          policy: null,
        },
      ]);
      expect(turn.blocks.map((block) => block.kind)).toEqual(['REFERRAL']);
      expect(JSON.stringify(turn.blocks)).toContain('cannot make that determination');
    },
  );

  acceptanceIt(
    'AC47',
    'step 5: ask my advisor gives a case preview and no case exists',
    async () => {
      const { turn } = await say('Please ask my advisor to review my plan');

      expect(turn.intro).toBe(
        'Here is a preview of the case. Nothing is sent until you confirm it.',
      );
      expect(turn.modelStatus).toBe('ANSWERED');
      expect(turn.blocks).toMatchObject([{ kind: 'CASE_PREVIEW', reason: 'PLAN_REVIEW' }]);
      expect(world.cases).toEqual([]);
      expect(world.caseEvents).toEqual([]);
    },
  );

  acceptanceIt(
    'AC47',
    'step 6: creating the case through the existing endpoint pins the revision and the case has no transcript',
    async () => {
      // NOTE: the default option the save helpers pick lives in these sections, not the demo ones.
      publishSections(world, [MATH_MWF, PHYS_TTH]);
      expect(world.cases).toEqual([]);
      const saved = dataOf(await saveDefaultOption(app));
      const revisionId = (saved.latest as { id: string }).id;
      const created = await createCase(app, planReviewBody(revisionId));

      expect(created.statusCode).toBe(201);
      expect(dataOf(created)).toMatchObject({
        status: 'OPEN',
        reason: 'PLAN_REVIEW',
        context: { id: revisionId, revision: 1 },
      });
      const stored = JSON.stringify(dataOf(created)).toLowerCase();
      expect(stored).not.toContain('transcript');
      expect(stored).not.toContain('"turns"');
      for (const message of sentMessages) {
        expect(stored).not.toContain(message.toLowerCase());
      }
      expect(world.cases).toHaveLength(1);
    },
  );
});
