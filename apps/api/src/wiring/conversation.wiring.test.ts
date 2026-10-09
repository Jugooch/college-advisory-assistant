/**
 * @file Tests of the wiring's model choice: off, demo, Claude, and the test seam. The production refusals
 * are tested with the configuration in `config/env.test.ts`.
 * @requirement FR-01
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';

import { createScriptedModel } from '@caa/assistant';

import { loadApiEnv } from '../config/env';
import { chooseConversationModel, DEMO_MODEL_ID, INJECTED_MODEL_ID } from './conversation.wiring';

const BASE = {
  APP_VERSION: 'test',
  DATABASE_URL: 'postgres://unused.invalid/test',
  AUTH_MODE: 'dev',
  DEV_AUTH_TOKENS: '{}',
};

const env = (extra: Record<string, string>) => loadApiEnv({ ...BASE, NODE_ENV: 'test', ...extra });

describe('chooseConversationModel', () => {
  it('is off by default', () => {
    expect(chooseConversationModel(env({}), undefined)).toBeNull();
  });

  it('picks the demo model', () => {
    expect(chooseConversationModel(env({ CONVERSATION_MODEL: 'demo' }), undefined)?.modelId).toBe(
      DEMO_MODEL_ID,
    );
  });

  it('builds Claude from its key and model id', () => {
    const chosen = chooseConversationModel(
      env({ CONVERSATION_MODEL: 'claude', ANTHROPIC_API_KEY: 'synthetic-key' }),
      undefined,
    );

    expect(chosen?.modelId).toBe('claude-haiku-5-5');
  });

  it('lets a test inject a model, even with chat configured off', () => {
    const model = createScriptedModel([]);

    expect(chooseConversationModel(env({}), model)).toEqual({
      model,
      modelId: INJECTED_MODEL_ID,
    });
  });
});
