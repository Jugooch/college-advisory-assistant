/**
 * @file Acceptance AC50 (planning/13, ADR-0015 section 7 and Amendment 3): a student reloads a
 * conversation whose stored turns hold a tier-1 crisis referral, fixed notices, a referral at a
 * retired template version, and schedule-options, plan-evidence and policy references. Through
 * the conversation endpoints with the scripted model: the crisis referral and the notices show
 * again with their exact wording, re-rendered by the server from the stored template id and
 * version with no model call; a retired version gets no re-rendered entry; academic references
 * never do. Every wording is written out literally from the template contract, not read back
 * from the API.
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';
import { buildPolicyDocument } from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import type { AcceptanceApp, AcceptanceWorld } from '../support/api-harness';
import { CRISIS_REFERRAL } from '../support/chat-referral-fixtures';
import {
  createModelSlot,
  lastSequenceOf,
  postTurn,
  readTranscript,
  resetChatWorld,
  turnOf,
} from '../support/conversation-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import { BOTH_COURSES, resetPlanWorld, saveDefaultOption } from '../support/plan-drafts-harness';

const world = createAcademicWorld();
const slot = createModelSlot();

// NOTE: built once at module scope so Fastify's first build doesn't count against a case's timeout.
const app = buildAcademicApp(world, { conversationModel: slot.model, conversationRateLimit: 100 });

const UNKNOWN_PLAN_ID = '80000000-0000-4000-8000-0000000003e7';
/** A template version no release ever had, standing in for a retired one. */
const RETIRED_VERSION = '2020-01-01.1';

/** Wording of the fixed notices, written out literally from the notice templates. */
const OVERRIDE_PROCESS_TEXT =
  'Prerequisite and requirement overrides are decided through your institution’s official override process, not in this chat. Nothing shown here labels you as allowed or not allowed.';
const TOOL_FAILED_TEXT =
  'Something went wrong while looking that up, so no result is shown. Please try again.';
const PLANNER_INPUT_NEEDED_TEXT =
  'More information is needed before a schedule can be built. Use the planning form to add the missing choices.';

/** One stored assistant turn as the transcript returns it. */
interface StoredAssistantTurn {
  readonly role: string;
  readonly sequence: number;
  readonly blockRefs?: readonly { readonly kind: string; readonly templateVersion?: string }[];
  readonly templateBlocks?: readonly {
    readonly refIndex: number;
    readonly block: Record<string, unknown>;
  }[];
}

/**
 * Posts one message and returns the new last sequence, so the next turn can follow it.
 *
 * @param message - The student's text.
 * @param sequence - The last sequence the client has seen.
 * @param plannerInputs - The planner form state, when the turn needs one.
 * @returns The live response and the new last sequence.
 */
async function say(message: string, sequence: number, plannerInputs?: object) {
  const response = await postTurn(app, message, {
    expectedSequence: sequence,
    ...(plannerInputs === undefined ? {} : { plannerInputs }),
  });
  return { response, next: lastSequenceOf(response) ?? -1 };
}

/**
 * Reads the stored assistant turns of the transcript.
 *
 * @param target - The app to read through.
 * @returns The assistant turns, oldest first.
 */
async function assistantTurns(target: AcceptanceApp): Promise<readonly StoredAssistantTurn[]> {
  const transcript = await readTranscript(target);
  const turns = (transcript.body as { data: { turns: StoredAssistantTurn[] } }).data.turns;
  return turns.filter((turn) => turn.role === 'ASSISTANT');
}

/**
 * Replaces the stored template version of every referral and notice reference, simulating a
 * release that bumped the template version after the turns were stored.
 *
 * @param target - The harness world.
 * @param version - The version to store.
 */
function retireTemplateVersions(target: AcceptanceWorld, version: string): void {
  target.conversationTurns = (target.conversationTurns ?? []).map((turn) => ({
    ...turn,
    blockRefs: Array.isArray(turn.blockRefs)
      ? (turn.blockRefs as readonly { readonly kind: string }[]).map((ref) =>
          ref.kind === 'REFERRAL' || ref.kind === 'NOTICE'
            ? { ...ref, templateVersion: version }
            : ref,
        )
      : turn.blockRefs,
  }));
}

describe('AC50 reloading a conversation re-renders stored referral and notice blocks', () => {
  beforeEach(() => {
    resetChatWorld(world);
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC50',
    'shows the tier-1 crisis referral again with its exact wording and no model call',
    async () => {
      slot.use([]);
      const live = await say('I want to kill myself', 0);
      const model = slot.use([]);

      const [stored] = await assistantTurns(app);

      expect(stored?.blockRefs).toMatchObject([
        { kind: 'REFERRAL', templateId: 'referral.crisis' },
      ]);
      expect(stored?.templateBlocks).toHaveLength(1);
      expect(stored?.templateBlocks?.[0]).toMatchObject({
        refIndex: 0,
        block: {
          kind: 'REFERRAL',
          topic: 'CRISIS',
          templateId: 'referral.crisis',
          text: CRISIS_REFERRAL,
        },
      });
      expect(stored?.templateBlocks?.[0]?.block).toEqual(turnOf(live.response).blocks[0]);
      expect(model.requests).toHaveLength(0);
    },
  );

  acceptanceIt(
    'AC50',
    'shows fixed notices again with their exact wording: override process, tool failed, planner input needed',
    async () => {
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      const override = await say('Can you ignore the prerequisite for MATH 102?', 0);
      slot.use([
        toolCallStep(
          scriptedToolCall('call-1', 'get_validation_evidence', { planId: UNKNOWN_PLAN_ID }),
        ),
        finalStep('CANNOT_HELP'),
      ]);
      const failed = await say('Show my plan', override.next);
      slot.use([
        toolCallStep(scriptedToolCall('call-2', 'request_plan', {})),
        finalStep('CANNOT_HELP'),
      ]);
      const needsInput = await say('What are my options?', failed.next);
      const model = slot.use([]);

      const stored = await assistantTurns(app);

      expect(stored.map((turn) => turn.templateBlocks)).toMatchObject([
        [
          {
            refIndex: 0,
            block: { kind: 'NOTICE', code: 'OVERRIDE_PROCESS', text: OVERRIDE_PROCESS_TEXT },
          },
        ],
        [{ refIndex: 0, block: { kind: 'NOTICE', code: 'TOOL_FAILED', text: TOOL_FAILED_TEXT } }],
        [
          {
            refIndex: 0,
            block: {
              kind: 'NOTICE',
              code: 'PLANNER_INPUT_NEEDED',
              text: PLANNER_INPUT_NEEDED_TEXT,
            },
          },
        ],
      ]);
      expect(stored[0]?.templateBlocks?.[0]?.block).toEqual(turnOf(override.response).blocks[0]);
      expect(stored[1]?.templateBlocks?.[0]?.block).toEqual(turnOf(failed.response).blocks[0]);
      expect(stored[2]?.templateBlocks?.[0]?.block).toEqual(turnOf(needsInput.response).blocks[0]);
      expect(model.requests).toHaveLength(0);
    },
  );

  acceptanceIt(
    'AC50',
    'gives no entry to a referral or notice stored at a template version that is not current',
    async () => {
      slot.use([]);
      const crisis = await say('I want to kill myself', 0);
      slot.use([finalStep('ASK_FOR_DETAIL')]);
      await say('Can you ignore the prerequisite for MATH 102?', crisis.next);
      retireTemplateVersions(world, RETIRED_VERSION);
      const model = slot.use([]);

      const stored = await assistantTurns(app);

      expect(stored).toHaveLength(2);
      for (const turn of stored) {
        expect(turn.blockRefs).toHaveLength(1);
        expect(turn.blockRefs?.[0]?.templateVersion).toBe(RETIRED_VERSION);
        expect(turn.templateBlocks ?? []).toEqual([]);
      }
      expect(model.requests).toHaveLength(0);
    },
  );

  acceptanceIt(
    'AC50',
    'never gives a schedule-options, plan-evidence or policy-results reference an entry',
    async () => {
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
      const saved = await saveDefaultOption(app);
      const planId = (saved.body as { data: { id: string } }).data.id;
      slot.use([
        toolCallStep(scriptedToolCall('call-1', 'request_plan', {})),
        finalStep('SCHEDULE_OPTIONS'),
      ]);
      const options = await say('Show me options', 0, BOTH_COURSES);
      slot.use([
        toolCallStep(scriptedToolCall('call-2', 'get_validation_evidence', { planId })),
        finalStep('PLAN_EVIDENCE'),
      ]);
      const evidence = await say('Show my plan', options.next);
      slot.use([
        toolCallStep(
          scriptedToolCall('call-3', 'search_approved_policy', { query: 'drop a course' }),
        ),
        finalStep('POLICY_RESULTS'),
      ]);
      const policy = await say('What is the policy on dropping a course?', evidence.next);
      slot.use([]);
      const crisis = await say('I want to kill myself', policy.next);
      const model = slot.use([]);

      const stored = await assistantTurns(app);

      expect(stored.map((turn) => turn.blockRefs?.map((ref) => ref.kind))).toEqual([
        ['SCHEDULE_OPTIONS'],
        ['PLAN_EVIDENCE'],
        ['POLICY_RESULTS'],
        ['REFERRAL'],
      ]);
      expect(stored.slice(0, 3).map((turn) => turn.templateBlocks ?? [])).toEqual([[], [], []]);
      expect(stored[3]?.templateBlocks).toHaveLength(1);
      expect(crisis.response.statusCode).toBe(200);
      expect(model.requests).toHaveLength(0);
    },
  );
});
