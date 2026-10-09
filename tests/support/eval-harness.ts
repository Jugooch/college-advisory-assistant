/**
 * @file Harness for the T06 evaluations: the real API over the QA-owned in-memory world, a model
 * the case swaps per run (scripted, demo or live), and a session that posts turns as the signed-in
 * student and reads the plain JSON back. It reads responses with its own narrow types, not the
 * contract schemas, so the oracle stays independent of the code under test.
 * @module @caa/tests/support/eval-harness
 * @requirement FR-10
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import type { ConversationModel, ModelReply, ModelRequest } from '@caa/assistant';
import { buildPolicyCorpus, SYNTHETIC_SCHEDULE_TERM } from '@caa/test-kit';

import {
  ACADEMIC_STUDENT_ID,
  buildAcademicApp,
  createAcademicWorld,
  resetAcademicWorld,
} from './academic-endpoints-harness';
import type { AcceptanceApp, AcceptanceWorld } from './api-harness';
import { resetPlanWorld } from './plan-drafts-harness';

/** The term every eval converses in (the synthetic scheduling term). */
export const EVAL_TERM_ID = SYNTHETIC_SCHEDULE_TERM.termId;

/** A block as the eval reads it: its kind plus whatever else the server sent. */
export interface EvalBlock {
  readonly kind: string;
  readonly [key: string]: unknown;
}

/** One assistant answer as the eval reads it. */
export interface EvalTurn {
  readonly status: number;
  readonly intro: string;
  readonly modelStatus: string;
  readonly sequence: number | null;
  readonly blocks: readonly EvalBlock[];
  /** The raw response body, for searches over everything the student could see. */
  readonly raw: string;
}

/** Settings of one post. */
export interface SayOptions {
  /** Posts as another signed-in actor. */
  readonly actor?: 'student' | 'advisor' | 'otherStudent' | 'tenantBAdmin';
  /** Posts to another student's path. */
  readonly studentId?: string;
  /** The planner form's confirmed state; absent when the form is empty. */
  readonly plannerInputs?: object;
  /** Extra body keys. */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** What {@link createEvalRig} returns. */
export interface EvalRig {
  readonly world: AcceptanceWorld;
  readonly app: AcceptanceApp;
  /**
   * Starts a case: resets the world and conversation, and makes `model` answer.
   *
   * @param model - The model for this case.
   * @param options - `plans` also publishes sections so schedule options and saved plans exist.
   */
  readonly begin: (model: ConversationModel | null, options?: BeginOptions) => EvalSession;
}

/** Settings of one case's world. */
export interface BeginOptions {
  readonly plans?: boolean;
}

/** A student's conversation with the assistant, one case long. */
export interface EvalSession {
  /** Posts one student message and reads the answer. */
  readonly say: (message: string, options?: SayOptions) => Promise<EvalTurn>;
  /** Reads the stored transcript as the student, as raw JSON. */
  readonly transcript: () => Promise<string>;
  /** Every request the model received this case, in order. */
  readonly requests: readonly ModelRequest[];
}

/** The model call count a case can read without owning the model. */
class SwitchableModel implements ConversationModel {
  public current: ConversationModel | null = null;
  public readonly requests: ModelRequest[] = [];

  public respond(request: ModelRequest): Promise<ModelReply> {
    // NOTE: copy the message list now; the loop appends to its own array after the call.
    this.requests.push({ ...request, messages: [...request.messages] });
    if (this.current === null) {
      return Promise.reject(new Error('No eval model is set'));
    }
    return this.current.respond(request);
  }
}

/**
 * Reads one response body as an eval turn.
 * @param status - The status.
 * @param raw - The raw.
 */
function readTurn(status: number, raw: string): EvalTurn {
  const parsed: unknown = JSON.parse(raw);
  const data = (parsed as { data?: { turn?: Record<string, unknown> } }).data?.turn;
  if (status !== 200 || data === undefined) {
    return { status, intro: '', modelStatus: '', sequence: null, blocks: [], raw };
  }
  return {
    status,
    intro: data.intro as string,
    modelStatus: data.modelStatus as string,
    sequence: data.sequence as number | null,
    blocks: data.blocks as readonly EvalBlock[],
    raw,
  };
}

/**
 * Builds the app once and returns a rig that starts each case from a clean world. The model is
 * injected through a wrapper that records every request, so a case can see what the model was sent.
 *
 * @returns The rig.
 */
export function createEvalRig(): EvalRig {
  const world = createAcademicWorld();
  const switchable = new SwitchableModel();
  // NOTE: built once at module scope in each file so Fastify's first build isn't charged to a case.
  const app: AcceptanceApp = buildAcademicApp(world, { conversationModel: switchable });
  return {
    world,
    app,
    begin: (model, options = {}) => {
      if (options.plans === true) {
        resetPlanWorld(world);
      } else {
        resetAcademicWorld(world);
      }
      world.policyDocuments = buildPolicyCorpus();
      world.conversations = [];
      world.conversationTurns = [];
      world.conversationLastSequences = {};
      world.studentTurnLog = [];
      switchable.current = model;
      switchable.requests.length = 0;
      let last = 0;
      return {
        requests: switchable.requests,
        transcript: async () =>
          (
            await app.inject({
              method: 'GET',
              url: `/v1/students/${ACADEMIC_STUDENT_ID}/conversation?termId=${EVAL_TERM_ID}`,
              headers: { authorization: 'Bearer academic-student' },
            })
          ).body,
        say: async (message, options = {}) => {
          const response = await app.inject({
            method: 'POST',
            url: `/v1/students/${options.studentId ?? ACADEMIC_STUDENT_ID}/conversation/turns`,
            headers: { authorization: `Bearer academic-${options.actor ?? 'student'}` },
            payload: {
              termId: EVAL_TERM_ID,
              message,
              expectedSequence: last,
              ...(options.plannerInputs === undefined
                ? {}
                : { plannerInputs: options.plannerInputs }),
              ...options.extra,
            },
          });
          const turn = readTurn(response.statusCode, response.body);
          const next = (JSON.parse(response.body) as { data?: { lastSequence?: number } }).data
            ?.lastSequence;
          if (next !== undefined) last = next;
          return turn;
        },
      };
    },
  };
}
