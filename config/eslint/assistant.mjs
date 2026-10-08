/**
 * @file Import and purity rules for the assistant package and the model SDK boundary: the
 * assistant is pure and depends only on `@caa/domain`, and `@anthropic-ai/sdk` is imported only
 * by the API adapters that implement the assistant's model port (ADR-0015 §1 and §9).
 * @module config/eslint/assistant
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { determinismBans } from './determinism.mjs';
import {
  appForbid,
  forbid,
  FRAMEWORKS,
  LANGUAGE_SYNTAX_BANS,
  NODE_BUILTINS,
  otherApps,
  SDK_ADAPTER_FILES,
  SDK_RESTRICTION,
  WIRING,
  WIRING_MSG,
} from './layer-boundaries.mjs';

/** Why assistant production code may not import Node built-ins. */
const NODE_BUILTIN_MESSAGE =
  'assistant is pure (ADR-0015 §1): no Node built-ins, so no I/O, clock, or randomness. Reach the model through a port.';

/** The network global the assistant must not call; the API adapter owns the model call. */
const FETCH_BAN = {
  name: 'fetch',
  message: 'The assistant makes no network calls; the model is behind a port (ADR-0015 §1).',
};

/**
 * Removes the SDK restriction from a `forbid` result, for the one folder allowed to import it.
 *
 * @param {import('eslint').Linter.RuleEntry} entry - An `appForbid` result.
 * @returns {import('eslint').Linter.RuleEntry} The entry without the SDK pattern.
 */
function allowSdk(entry) {
  const [severity, options] = entry;
  return [
    severity,
    { ...options, patterns: options.patterns.filter((p) => p !== SDK_RESTRICTION) },
  ];
}

/** Flat-config blocks for the assistant package and the SDK adapter folder; they follow `layerBoundaries`. */
export const assistantRules = [
  {
    files: ['packages/assistant/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/engine', '@caa/api-contract', 'drizzle-orm', 'pg', ...FRAMEWORKS],
        'assistant depends only on @caa/domain; data and the model come in through injected ports.',
        { paths: NODE_BUILTINS, regex: '^node:', message: NODE_BUILTIN_MESSAGE },
      ),
      ...determinismBans(
        LANGUAGE_SYNTAX_BANS,
        'new Date() reads the clock; pass the time in as an argument (NFR-01).',
        [FETCH_BAN],
      ),
    },
  },
  {
    files: [SDK_ADAPTER_FILES],
    rules: {
      'no-restricted-imports': allowSdk(appForbid([WIRING, ...otherApps('api')], WIRING_MSG)),
    },
  },
];
