/**
 * @file Helpers for the chat acceptance cases (AC43-AC46): a model whose script a case swaps per
 * request, the turn, transcript and clear calls through `app.inject`, and a world reset. The
 * scripted model is the `@caa/assistant` fake; the expectations in the cases never come from
 * production logic (docs/standards/07-testing.md).
 * @module @caa/tests/support/conversation-harness
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import {
  type ConversationModel,
  createScriptedModel,
  type ScriptedModel,
  type ScriptedStep,
} from '@caa/assistant';
import { SYNTHETIC_SCHEDULE_TERM } from '@caa/test-kit';

import { ACADEMIC_STUDENT_ID, type AcademicRequestAs } from './academic-endpoints-harness';
import {
  type AcceptanceApp,
  type AcceptanceResponse,
  type AcceptanceWorld,
  postAs,
} from './api-harness';
import { resetScheduleWorld } from './schedule-options-harness';

/** The term every chat case plans for. */
export const CHAT_TERM_ID: string = SYNTHETIC_SCHEDULE_TERM.termId;

/** A model whose script a case replaces before each request. */
export interface ModelSlot {
  /** The model to hand to the API once, at build time. */
  readonly model: ConversationModel;
  /**
   * Installs a fresh script for the next request.
   *
   * @param steps - The script.
   * @returns The scripted model, so the case can read what it was sent.
   */
  readonly use: (steps: readonly ScriptedStep[]) => ScriptedModel;
}

/**
 * Creates a model slot. Until a case calls `use`, the model has an empty script, so any call fails
 * as an unavailable model and a case that must make no call can check the script it installed.
 *
 * @returns The slot.
 */
export function createModelSlot(): ModelSlot {
  let current = createScriptedModel([]);
  return {
    model: { respond: (request) => current.respond(request) },
    use: (steps) => {
      current = createScriptedModel(steps);
      return current;
    },
  };
}

/** What a case varies about a turn. */
export interface TurnOptions extends AcademicRequestAs {
  /** The planner form's confirmed state, or absent for an empty form. */
  readonly plannerInputs?: object;
  /** Defaults to 0, an empty transcript. */
  readonly expectedSequence?: number;
}

/**
 * Posts one student message.
 *
 * @param app - App under test.
 * @param message - The student's text.
 * @param options - Actor, student, form state and expected sequence.
 * @returns Status and parsed body.
 */
export function postTurn(
  app: AcceptanceApp,
  message: string,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID, ...rest }: TurnOptions = {},
): Promise<AcceptanceResponse> {
  return postRawTurn(
    app,
    {
      termId: CHAT_TERM_ID,
      message,
      expectedSequence: rest.expectedSequence ?? 0,
      ...(rest.plannerInputs === undefined ? {} : { plannerInputs: rest.plannerInputs }),
    },
    { actor, studentId },
  );
}

/**
 * Posts a turn body exactly as given, for cases that send a body the client never would.
 *
 * @param app - App under test.
 * @param payload - The raw JSON body.
 * @param who - Actor and student.
 * @returns Status and parsed body.
 */
export function postRawTurn(
  app: AcceptanceApp,
  payload: object,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${studentId}/conversation/turns`,
    authorization: `Bearer academic-${actor}`,
    payload,
  });
}

/**
 * Reads the transcript.
 *
 * @param app - App under test.
 * @param who - Actor and student.
 * @returns Status and parsed body.
 */
export async function readTranscript(
  app: AcceptanceApp,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  const response = await app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}/conversation?termId=${CHAT_TERM_ID}`,
    headers: { authorization: `Bearer academic-${actor}` },
  });
  return { statusCode: response.statusCode, body: response.json() };
}

/**
 * Clears the transcript.
 *
 * @param app - App under test.
 * @param who - Actor and student.
 * @returns Status and the parsed body, or `null` for the empty 204 body.
 */
export async function clearTranscript(
  app: AcceptanceApp,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  const response = await app.inject({
    method: 'DELETE',
    url: `/v1/students/${studentId}/conversation?termId=${CHAT_TERM_ID}`,
    headers: { authorization: `Bearer academic-${actor}` },
  });
  return {
    statusCode: response.statusCode,
    body: response.body === '' ? null : response.json(),
  };
}

/** An assistant turn as the cases read it. */
export interface TurnView {
  readonly sequence: number | null;
  readonly intro: string;
  readonly modelStatus: string;
  readonly blocks: readonly { readonly kind: string; readonly [field: string]: unknown }[];
}

/**
 * Reads the turn out of a response body.
 *
 * @param response - A turn response.
 * @returns The turn, or an empty object cast when the body has none, so a case's assertion fails
 *   on the literal values instead of throwing here.
 */
export function turnOf(response: AcceptanceResponse): TurnView {
  const body = response.body as { data?: { turn?: TurnView } } | null;
  return (
    body?.data?.turn ?? { sequence: null, intro: '<no turn>', modelStatus: '<no turn>', blocks: [] }
  );
}

/**
 * Lists the kinds of a turn's blocks, in order.
 *
 * @param response - A turn response.
 * @returns The block kinds.
 */
export function blockKinds(response: AcceptanceResponse): readonly string[] {
  return turnOf(response).blocks.map((block) => block.kind);
}

/**
 * Resets the world to the schedule scenario (no sections published) with an empty transcript store.
 *
 * @param world - The harness world.
 */
export function resetChatWorld(world: AcceptanceWorld): void {
  resetScheduleWorld(world);
  world.conversations = [];
  world.conversationTurns = [];
  world.conversationLastSequences = {};
  world.studentTurnLog = [];
}

/**
 * Reads `lastSequence` out of a turn response.
 *
 * @param response - A turn response.
 * @returns The last sequence, or `undefined` when the body has none.
 */
export function lastSequenceOf(response: AcceptanceResponse): number | undefined {
  const body = response.body as { data?: { lastSequence?: number } } | null;
  return body?.data?.lastSequence;
}
