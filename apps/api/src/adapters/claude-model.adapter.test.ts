/**
 * @file Tests for the Claude adapter with a fake client: mapping, failures, retry, and timeout.
 * @requirement FR-14
 * @requirement NFR-05
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { ModelRequest } from '@caa/assistant';

import {
  type ClaudeClient,
  createClaudeModel,
  createClaudeModelFromEnv,
  ModelUnavailableError,
} from './claude-model.adapter';

const REQUEST: ModelRequest = {
  system: 'system text',
  messages: [
    { role: 'user', text: 'hi' },
    {
      role: 'assistant',
      text: '',
      toolCalls: [
        { id: 't1', name: 'get_academic_summary', arguments: {} },
        { id: 't2', name: 'search_approved_policy', arguments: { query: 'x' } },
      ],
    },
    { role: 'tool', toolCallId: 't1', toolName: 'get_academic_summary', content: 'one' },
    { role: 'tool', toolCallId: 't2', toolName: 'search_approved_policy', content: 'two' },
  ],
  tools: [
    {
      name: 'get_academic_summary',
      description: 'd',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
};

const TEXT_REPLY = { content: [{ type: 'text', text: 'hello' }], stop_reason: 'end_turn' };

type Step = { reply: unknown } | { error: Error };
type FakeClient = ClaudeClient & { calls: [Record<string, unknown>, unknown][] };

function fakeClient(...steps: Step[]): FakeClient {
  const calls: FakeClient['calls'] = [];
  const queue = [...steps];
  return {
    calls,
    messages: {
      create: (params, options) => {
        calls.push([params as unknown as Record<string, unknown>, options]);
        const step = queue.shift();
        if (step === undefined) return Promise.reject(new Error('no step left'));
        return 'error' in step ? Promise.reject(step.error) : Promise.resolve(step.reply);
      },
    },
  };
}

function apiError(status: number): Error {
  return new Anthropic.APIError(status, undefined, 'secret provider text', new Headers());
}

function model(client: ClaudeClient) {
  return createClaudeModel({ apiKey: 'k', modelId: 'claude-haiku-5-5', timeoutMs: 5000, client });
}

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ModelUnavailableError);
  expect((error as ModelUnavailableError).message).not.toContain('secret');
  return (error as ModelUnavailableError).reason;
}

describe('createClaudeModel mapping', () => {
  it('sends the model, system, tools, merged tool results, and the timeout', async () => {
    const client = fakeClient({ reply: TEXT_REPLY });
    await model(client).respond(REQUEST);
    const [params, options] = client.calls.at(0) ?? [];
    expect(params).toMatchObject({
      model: 'claude-haiku-5-5',
      system: 'system text',
      tools: [{ name: 'get_academic_summary', description: 'd', input_schema: { type: 'object' } }],
    });
    expect(params?.messages).toEqual([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 't1', name: 'get_academic_summary', input: {} },
          { type: 'tool_use', id: 't2', name: 'search_approved_policy', input: { query: 'x' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'one' },
          { type: 'tool_result', tool_use_id: 't2', content: 'two' },
        ],
      },
    ]);
    expect(options).toEqual({ timeout: 5000, maxRetries: 0 });
  });

  it('maps text, tool calls, and stop reason back, skipping unknown blocks', async () => {
    const client = fakeClient({
      reply: {
        content: [
          { type: 'thinking', thinking: 'x' },
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
          { type: 'tool_use', id: 'c1', name: 'nope', input: { z: 1 } },
        ],
        stop_reason: 'tool_use',
      },
    });
    await expect(model(client).respond(REQUEST)).resolves.toEqual({
      text: 'ab',
      toolCalls: [{ id: 'c1', name: 'nope', arguments: { z: 1 } }],
      stopReason: 'TOOL_USE',
    });
  });

  it('maps max_tokens', async () => {
    const client = fakeClient({ reply: { ...TEXT_REPLY, stop_reason: 'max_tokens' } });
    expect((await model(client).respond(REQUEST)).stopReason).toBe('MAX_TOKENS');
  });
});

describe('createClaudeModel failures', () => {
  it.each([
    [new Anthropic.APIConnectionTimeoutError(), 'TIMEOUT'],
    [apiError(401), 'AUTH'],
    [apiError(403), 'AUTH'],
    [apiError(429), 'RATE_LIMIT'],
    [apiError(500), 'SERVER_ERROR'],
    [apiError(400), 'BAD_REQUEST'],
    [new Error('network down'), 'UNKNOWN'],
  ])('maps a thrown error to ModelUnavailableError', async (error, reason) => {
    const client = fakeClient({ error });
    expect(await reasonOf(model(client).respond(REQUEST))).toBe(reason);
    expect(client.calls).toHaveLength(1);
  });

  it.each([
    ['not an object', null],
    ['no content', { stop_reason: 'end_turn' }],
    ['unknown stop reason', { content: [], stop_reason: 'refusal' }],
    [
      'tool use without id',
      { content: [{ type: 'tool_use', name: 'a' }], stop_reason: 'tool_use' },
    ],
  ])('maps a malformed reply (%s)', async (_label, reply) => {
    expect(await reasonOf(model(fakeClient({ reply })).respond(REQUEST))).toBe('MALFORMED_REPLY');
  });
});

describe('createClaudeModel retry', () => {
  it('retries once after an overload and returns the second reply', async () => {
    const client = fakeClient({ error: apiError(529) }, { reply: TEXT_REPLY });
    expect((await model(client).respond(REQUEST)).text).toBe('hello');
    expect(client.calls).toHaveLength(2);
  });

  it('never retries twice', async () => {
    const overloaded = { error: apiError(529) };
    const client = fakeClient(overloaded, overloaded, { reply: TEXT_REPLY });
    expect(await reasonOf(model(client).respond(REQUEST))).toBe('OVERLOADED');
    expect(client.calls).toHaveLength(2);
  });
});

describe('createClaudeModelFromEnv', () => {
  it('requires the key', () => {
    expect(() => createClaudeModelFromEnv({})).toThrow();
  });

  it('builds a model from the key without calling the network', () => {
    expect(createClaudeModelFromEnv({ ANTHROPIC_API_KEY: 'k' })).toHaveProperty('respond');
  });
});
