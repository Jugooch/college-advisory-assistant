/**
 * @file Picks the conversation model from validated configuration: none, the scripted demo, or
 * Claude, with a model a test injects replacing all three.
 * @module @caa/api/adapters/conversation-model.adapter
 * @requirement FR-01
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 1)
 */
import { type ConversationModel, createDemoModel } from '@caa/assistant';

import { type ApiEnv, ConversationModelMode } from '../config/env';
import { createClaudeModel, DEFAULT_MODEL_TIMEOUT_MS } from './claude-model.adapter';

/** The model id recorded when a test injects a model. */
export const INJECTED_MODEL_ID = 'injected-test-model';

/** The model id recorded for the demo model. */
export const DEMO_MODEL_ID = 'demo-model';

/** The chosen model and the id recorded with each turn. */
export interface ChosenModel {
  readonly model: ConversationModel;
  readonly modelId: string;
}

/**
 * Picks the conversation model from configuration. `loadApiEnv` has already refused the demo
 * model in production, and Claude without a key or, in production, an approval ref.
 *
 * @param env - Configuration validated by `loadApiEnv`.
 * @param injected - A model a test supplies; it replaces the configured one.
 * @returns The model, or `null` when chat is off.
 */
export function chooseConversationModel(
  env: ApiEnv,
  injected: ConversationModel | undefined,
): ChosenModel | null {
  if (injected !== undefined) return { model: injected, modelId: INJECTED_MODEL_ID };
  // SAFETY: the switch is the kill switch (ADR-0015 section 1); `off` builds no model at all.
  switch (env.CONVERSATION_MODEL) {
    case ConversationModelMode.Off:
      return null;
    case ConversationModelMode.Demo:
      return { model: createDemoModel(), modelId: DEMO_MODEL_ID };
    case ConversationModelMode.Claude:
      // NOTE: narrowing only; env validation guarantees the key for `claude`.
      if (env.ANTHROPIC_API_KEY === undefined) return null;
      return {
        model: createClaudeModel({
          apiKey: env.ANTHROPIC_API_KEY,
          modelId: env.CONVERSATION_MODEL_ID,
          timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
        }),
        modelId: env.CONVERSATION_MODEL_ID,
      };
  }
}
