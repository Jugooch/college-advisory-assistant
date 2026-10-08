/**
 * @file Claude implementation of the conversation model port: maps the port to the Messages API.
 * @module @caa/api/adapters/claude-model
 * @requirement FR-14
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/standards/09-errors-logging-and-security.md
 *
 * This is the only file that imports `@anthropic-ai/sdk` (lint, ADR-0015 §9). It logs nothing:
 * no request, reply, key, or text leaves it except through the port's return value.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type {
  ConversationModel,
  ModelMessage,
  ModelReply,
  ModelRequest,
  ModelStopReason,
  ModelToolCall,
} from '@caa/assistant';

import { loadClaudeModelEnv } from '../config/env';

/** Per-call timeout when the caller sets none. */
export const DEFAULT_MODEL_TIMEOUT_MS = 30_000;

/** Largest reply the model may write, in tokens. */
const MAX_OUTPUT_TOKENS = 1024;

/** Why a call failed. Only the category is kept, never the provider's message. */
export type ModelUnavailableReason =
  | 'TIMEOUT'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'OVERLOADED'
  | 'SERVER_ERROR'
  | 'BAD_REQUEST'
  | 'MALFORMED_REPLY'
  | 'UNKNOWN';

/** The model could not answer. The orchestrator falls back to the no-model path (ADR-0015 §1). */
export class ModelUnavailableError extends Error {
  /** The failure category, safe to log. */
  readonly reason: ModelUnavailableReason;

  /**
   * Creates the error.
   *
   * @param reason - The failure category.
   */
  constructor(reason: ModelUnavailableReason) {
    super(`The conversation model is unavailable (${reason})`);
    this.name = 'ModelUnavailableError';
    this.reason = reason;
  }
}

/** The one SDK call the adapter makes. Narrow so tests inject a fake with no network. */
export interface ClaudeClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options: { timeout: number; maxRetries: number },
    ): Promise<unknown>;
  };
}

/** Settings for {@link createClaudeModel}. */
export interface ClaudeModelOptions {
  /** The provider key, read from the environment by `config/env.ts` only. */
  readonly apiKey: string;
  readonly modelId: string;
  /** Per-call timeout in milliseconds. */
  readonly timeoutMs: number;
  /** A replacement client, for tests. */
  readonly client?: ClaudeClient;
}

const ReplySchema = z.object({
  content: z.array(
    z.union([
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({
        type: z.literal('tool_use'),
        id: z.string().min(1),
        name: z.string().min(1),
        input: z.unknown(),
      }),
      // Blocks the port has no use for, such as thinking, are skipped rather than refused.
      z
        .object({ type: z.string().refine((type) => type !== 'text' && type !== 'tool_use') })
        .transform(() => ({ type: 'ignored' as const })),
    ]),
  ),
  stop_reason: z.enum(['end_turn', 'tool_use', 'max_tokens']),
});

const STOP_REASONS: Record<z.infer<typeof ReplySchema>['stop_reason'], ModelStopReason> = {
  end_turn: 'END_TURN',
  tool_use: 'TOOL_USE',
  max_tokens: 'MAX_TOKENS',
};

/**
 * Maps a model message to provider content blocks.
 *
 * @param message - An assistant message.
 * @returns Its text and tool calls as blocks.
 */
function assistantBlocks(
  message: Extract<ModelMessage, { role: 'assistant' }>,
): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  if (message.text !== '') content.push({ type: 'text', text: message.text });
  for (const call of message.toolCalls) {
    content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments ?? {} });
  }
  return content;
}

/**
 * Adds a tool result, joining it to the previous message when that is also tool results.
 *
 * @param out - The provider messages built so far.
 * @param block - The tool result block.
 */
function addToolResult(out: Anthropic.MessageParam[], block: Anthropic.ToolResultBlockParam): void {
  const last = out.at(-1);
  if (last?.role === 'user' && Array.isArray(last.content) && last.content.every(isToolResult)) {
    last.content.push(block);
  } else {
    out.push({ role: 'user', content: [block] });
  }
}

/**
 * Maps port messages to Messages API messages. Consecutive tool results become one user message,
 * as the API requires.
 *
 * @param messages - The conversation in port form.
 * @returns The same conversation in provider form.
 */
function toProviderMessages(messages: readonly ModelMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const message of messages) {
    if (message.role === 'user') out.push({ role: 'user', content: message.text });
    else if (message.role === 'assistant') {
      out.push({ role: 'assistant', content: assistantBlocks(message) });
    } else {
      addToolResult(out, {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
      });
    }
  }
  return out;
}

/**
 * Checks for a tool result block.
 *
 * @param block - A content block.
 * @returns Whether it is a tool result.
 */
function isToolResult(block: Anthropic.ContentBlockParam): boolean {
  return block.type === 'tool_result';
}

/**
 * Parses the provider reply into the port's shape.
 *
 * @param raw - The unvalidated SDK response.
 * @returns The reply.
 * @throws {ModelUnavailableError} When the reply doesn't match the expected shape.
 */
function toModelReply(raw: unknown): ModelReply {
  const parsed = ReplySchema.safeParse(raw);
  if (!parsed.success) throw new ModelUnavailableError('MALFORMED_REPLY');
  const toolCalls: ModelToolCall[] = [];
  let text = '';
  for (const block of parsed.data.content) {
    if (block.type === 'text') text += block.text;
    else if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, arguments: block.input });
    }
  }
  return { text, toolCalls, stopReason: STOP_REASONS[parsed.data.stop_reason] };
}

/**
 * Names a failure by its HTTP status.
 *
 * @param status - The response status.
 * @returns The failure category.
 */
function classifyStatus(status: unknown): ModelUnavailableReason {
  if (typeof status !== 'number') return 'UNKNOWN';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 529) return 'OVERLOADED';
  return status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST';
}

/**
 * Classifies a failed call without keeping its message.
 *
 * @param error - Whatever the client threw.
 * @returns The failure category.
 */
function classify(error: unknown): ModelUnavailableReason {
  if (error instanceof ModelUnavailableError) return error.reason;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'TIMEOUT';
  if (error instanceof Anthropic.APIError) {
    const status: unknown = error.status;
    return classifyStatus(status);
  }
  return 'UNKNOWN';
}

/**
 * Creates the Claude model. It never falls back to another provider or model.
 *
 * @param options - Key, model id, timeout, and an optional injected client.
 * @returns A {@link ConversationModel}.
 */
export function createClaudeModel(options: ClaudeModelOptions): ConversationModel {
  // NOTE: the SDK's own retries are off; the one retry below is the only one (ADR-0015 §1).
  const client: ClaudeClient =
    options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 0 });
  const callOptions = { timeout: options.timeoutMs, maxRetries: 0 };

  const call = async (request: ModelRequest): Promise<unknown> =>
    client.messages.create(
      {
        model: options.modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: request.system,
        messages: toProviderMessages(request.messages),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        })),
      },
      callOptions,
    );

  return {
    async respond(request) {
      let raw: unknown;
      try {
        try {
          raw = await call(request);
        } catch (error) {
          // NOTE: only an overload is transient; everything else would fail again the same way.
          if (classify(error) !== 'OVERLOADED') throw error;
          raw = await call(request);
        }
        return toModelReply(raw);
      } catch (error) {
        throw new ModelUnavailableError(classify(error));
      }
    },
  };
}

/**
 * Builds the Claude model from environment variables, for QA's manual `eval:live`. Never used in CI.
 *
 * @param source - Raw environment, usually `process.env`.
 * @returns A {@link ConversationModel}.
 * @throws {z.ZodError} When the key is missing or the model id isn't allowed.
 */
export function createClaudeModelFromEnv(source: NodeJS.ProcessEnv): ConversationModel {
  const { apiKey, modelId } = loadClaudeModelEnv(source);
  return createClaudeModel({ apiKey, modelId, timeoutMs: DEFAULT_MODEL_TIMEOUT_MS });
}
