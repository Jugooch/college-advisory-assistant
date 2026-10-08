/**
 * @file Tests that the assistant package is pure and depends only on `@caa/domain`, and that
 * `@anthropic-ai/sdk` is importable only under `apps/api/src/adapters/` (ADR-0015 §1 and §9).
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintImport,
  lintWithRules,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

const RULES = ['no-restricted-properties', 'no-restricted-syntax', 'no-restricted-globals'];
const ASSISTANT_FILE = 'packages/assistant/src/guards/claim.guard.ts';
const SDK = '@anthropic-ai/sdk';

describe('the model SDK stays under api adapters', () => {
  it.each([
    'apps/api/src/modules/chat/chat.service.ts',
    'apps/api/src/container.ts',
    'apps/api/src/wiring/chat.wiring.ts',
    'apps/worker/src/main.ts',
    'apps/web/src/lib/api-client.ts',
    ASSISTANT_FILE,
    'packages/engine/src/verification/example.ts',
    'packages/db/src/client.ts',
    'packages/test-kit/src/index.ts',
  ])('forbids the SDK in %s', async (path) => {
    for (const specifier of [SDK, `${SDK}/resources`]) {
      const messages = await lintImport(path, specifier);

      expect(messages.join('\n')).toContain('only under apps/api/src/adapters');
    }
  });

  it('allows the SDK in an api adapter and its test', async () => {
    expect(await lintImport('apps/api/src/adapters/model.adapter.ts', SDK)).toEqual([]);
    expect(await lintImport('apps/api/src/adapters/model.adapter.test.ts', SDK)).toEqual([]);
  });

  it('keeps the other api restrictions inside adapters', async () => {
    const messages = await lintImport('apps/api/src/adapters/model.adapter.ts', '@caa/web');

    expect(messages.join('\n')).toContain('wiring');
  });
});

describe('assistant production code is pure (ADR-0015 §1)', () => {
  it.each([
    ['Date.now()', 'NFR-01'],
    ['Math.random()', 'NFR-01'],
    ['new Date()', 'new Date() reads the clock'],
    ['process.env.X', 'no environment'],
    ["fetch('https://example.test')", 'no network calls'],
  ])('forbids %s', async (expression, message) => {
    const messages = await lintWithRules(ASSISTANT_FILE, `export const x = ${expression};`, RULES);

    expect(messages.join('\n')).toContain(message);
  });

  it('allows a given time', async () => {
    expect(await lintWithRules(ASSISTANT_FILE, 'export const x = new Date(v);', RULES)).toEqual([]);
  });

  it.each(['node:fs', 'fs', 'node:crypto', 'path'])('forbids %s', async (specifier) => {
    const messages = await lintImport(ASSISTANT_FILE, specifier);

    expect(messages.join('\n')).toContain('assistant is pure');
  });

  it.each(['@caa/db', '@caa/engine', '@caa/api-contract', 'fastify', 'pg'])(
    'forbids %s',
    async (specifier) => {
      const messages = await lintImport(ASSISTANT_FILE, specifier);

      expect(messages.join('\n')).toContain('depends only on @caa/domain');
    },
  );

  it('allows @caa/domain and zod', async () => {
    expect(await lintImport(ASSISTANT_FILE, '@caa/domain')).toEqual([]);
    expect(await lintImport(ASSISTANT_FILE, 'zod')).toEqual([]);
  });

  it('lets assistant tests use Node built-ins', async () => {
    expect(
      await lintImport('packages/assistant/src/guards/claim.guard.test.ts', 'node:fs'),
    ).toEqual([]);
  });
});
