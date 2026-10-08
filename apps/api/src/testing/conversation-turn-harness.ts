/**
 * @file Test harness for the conversation turn endpoint: the synthetic app with a scripted model,
 * a helper that posts a turn as the signed-in student, and readers for the stored transcript.
 * @module @caa/api/testing/conversation-turn-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import {
  type ConversationTurnRequest,
  type ConversationTurnResponse,
  ConversationTurnResponseSchema,
} from '@caa/api-contract';
import { createScriptedModel, type ScriptedModel, type ScriptedStep } from '@caa/assistant';
import type { Conversation } from '@caa/domain';
import { buildConversation, SYNTHETIC_SCHEDULE_TERM } from '@caa/test-kit';

import { bearer, buildWorldApp, STUDENTS, TOKENS } from './fixtures';
import type { InMemoryStore } from './in-memory-repositories';

/** The term the harness converses in. */
export const TURN_TERM_ID = SYNTHETIC_SCHEDULE_TERM.termId;

/** Settings a turn test varies. */
export interface TurnHarnessOptions {
  /** The script; omit it for an app with chat off. */
  readonly steps?: readonly ScriptedStep[];
  readonly rateLimit?: number;
  readonly historyTurns?: number;
}

/** Posts one turn as the signed-in student, unless told otherwise. */
export interface PostOptions {
  readonly token?: string;
  readonly studentId?: string;
  readonly expectedSequence?: number;
  /** Extra body keys, to prove the strict body refuses them. */
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly plannerInputs?: ConversationTurnRequest['plannerInputs'];
}

/** The status, raw body and parsed response of a posted turn. */
export interface PostResult {
  readonly status: number;
  readonly raw: string;
  /** The parsed response, or `null` when the status isn't 200. */
  readonly turn: ConversationTurnResponse | null;
}

const parseTurn = (body: unknown): ConversationTurnResponse =>
  ConversationTurnResponseSchema.parse(z.object({ data: z.unknown() }).parse(body).data);

/** What {@link setupTurnApp} returns. */
export interface TurnHarness {
  readonly app: FastifyInstance;
  readonly store: InMemoryStore;
  /** The scripted model, or `undefined` when chat is off. */
  readonly model: ScriptedModel | undefined;
  /** Every log line the app wrote. */
  readonly lines: string[];
  readonly conversation: Conversation;
  /** Posts a turn and parses the response. */
  readonly post: (message: string, options?: PostOptions) => Promise<PostResult>;
  /** Posts a turn and returns the raw response. */
  readonly postRaw: (message: string, options?: PostOptions) => Promise<LightMyRequestResponse>;
}

/**
 * Builds the synthetic app with an empty conversation for the signed-in student.
 *
 * @param options - The script and limits.
 * @returns The app, its store, the scripted model, log lines and a post helper.
 */
export function setupTurnApp(options: TurnHarnessOptions = {}): TurnHarness {
  const lines: string[] = [];
  const model: ScriptedModel | undefined =
    options.steps === undefined ? undefined : createScriptedModel(options.steps);
  const { app, store } = buildWorldApp(
    {
      write: (line) => {
        lines.push(line);
      },
    },
    {},
    {
      ...(model === undefined ? {} : { conversationModel: model }),
      ...(options.rateLimit === undefined ? {} : { conversationRateLimit: options.rateLimit }),
      ...(options.historyTurns === undefined
        ? {}
        : { conversationHistoryTurns: options.historyTurns }),
    },
  );
  const conversation = buildConversation({ studentId: STUDENTS.own.id, termId: TURN_TERM_ID });
  store.conversations = [conversation];
  store.conversationTurns = [];
  store.studentTurnLog = [];

  const postRaw = (message: string, post: PostOptions = {}) =>
    app.inject({
      method: 'POST',
      url: `/v1/students/${post.studentId ?? STUDENTS.own.id}/conversation/turns`,
      headers: bearer(post.token ?? TOKENS.student),
      payload: {
        termId: TURN_TERM_ID,
        message,
        expectedSequence: post.expectedSequence ?? store.conversationTurns?.length ?? 0,
        ...(post.plannerInputs === undefined ? {} : { plannerInputs: post.plannerInputs }),
        ...post.extra,
      },
    });
  const post = async (message: string, posted: PostOptions = {}): Promise<PostResult> => {
    const response = await postRaw(message, posted);
    return {
      status: response.statusCode,
      raw: response.body,
      turn: response.statusCode === 200 ? parseTurn(response.json()) : null,
    };
  };
  return { app, store, model, lines, conversation, post, postRaw };
}
