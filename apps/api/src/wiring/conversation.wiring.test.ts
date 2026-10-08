/**
 * @file Tests of the model choice: off, demo, Claude, the test seam, and the production refusals.
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

  it('refuses demo in production, and Claude without a key or approval', () => {
    const production = { ...env({}), NODE_ENV: 'production' as const };

    expect(() =>
      chooseConversationModel({ ...production, CONVERSATION_MODEL: 'demo' }, undefined),
    ).toThrow(/production/);
    expect(() =>
      chooseConversationModel({ ...env({}), CONVERSATION_MODEL: 'claude' }, undefined),
    ).toThrow(/ANTHROPIC_API_KEY/);
    expect(() =>
      chooseConversationModel(
        { ...production, CONVERSATION_MODEL: 'claude', ANTHROPIC_API_KEY: 'k' },
        undefined,
      ),
    ).toThrow(/APPROVAL_REF/);
  });
});
