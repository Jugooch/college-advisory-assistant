/**
 * @file Determinism rules for pure code: the engine, the domain's shared invariants (ADR-0005),
 * and api `.logic.ts` files (ADR-0008). No clock, timer, randomness, environment, or locale, and
 * no sort of non-strings without a comparator (standards/01 §Determinism in pure code, NFR-01).
 * @module config/eslint/determinism
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0008-api-logic-role-and-source-freshness.md
 */

/** Clock, randomness, and locale reads that make code nondeterministic (NFR-01). */
const NONDETERMINISTIC_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Pure code must be deterministic (NFR-01).' },
  { object: 'Date', property: 'now', message: 'Pass the time in as an argument (NFR-01).' },
  {
    property: 'localeCompare',
    message: 'localeCompare depends on locale data; compare strings with < and > (NFR-01).',
  },
];

/** Why pure code may not schedule work on a timer. */
const TIMER_MESSAGE =
  'Pure code uses no timers; count work against a cap instead (ADR-0010, NFR-01).';

/** Globals that read the environment, the clock, timers, locale data, or randomness (NFR-01). */
const NONDETERMINISTIC_GLOBALS = [
  { name: 'process', message: 'Pure code reads no environment or process state (NFR-01).' },
  { name: 'crypto', message: 'Pure code uses no randomness (NFR-01).' },
  { name: 'performance', message: 'Pure code reads no clock; pass the time in (NFR-01).' },
  { name: 'setTimeout', message: TIMER_MESSAGE },
  { name: 'setInterval', message: TIMER_MESSAGE },
  { name: 'setImmediate', message: TIMER_MESSAGE },
  {
    name: 'Intl',
    message: 'Intl depends on locale data; order strings by UTF-16 code unit (NFR-01).',
  },
];

/**
 * Every sort of non-strings needs an explicit comparator; a bare `.sort()` on strings is the
 * UTF-16 code-unit order standards/01 asks for. The rule uses type information.
 */
const SORT_COMPARE_RULE = ['error', { ignoreStringArrays: true }];

/** `Date()` called without `new` returns the current time as a string. */
const DATE_CALL = {
  selector: "CallExpression[callee.name='Date']",
  message: 'Date() reads the clock; pass the time in as an argument (NFR-01).',
};

/** Selects `new Date()` (or `new Date`) with no arguments; `new Date(value)` is fine. */
const NEW_DATE_NOW_SELECTOR = "NewExpression[callee.name='Date'][arguments.length=0]";

/**
 * Builds the determinism rule entries for a pure-code flat-config block. Test files keep them
 * too, like engine tests always have.
 *
 * @param {object[]} syntaxBans - The `no-restricted-syntax` entries every file carries, which a
 *   block that adds syntax bans must repeat.
 * @param {string} newDateMessage - Why an argument-less `new Date()` is banned, naming where the
 *   time comes from instead.
 * @returns {Record<string, import('eslint').Linter.RuleEntry>} The rule entries.
 */
export function determinismBans(syntaxBans, newDateMessage) {
  return {
    'no-restricted-properties': ['error', ...NONDETERMINISTIC_PROPERTIES],
    'no-restricted-globals': ['error', ...NONDETERMINISTIC_GLOBALS],
    'no-restricted-syntax': [
      'error',
      ...syntaxBans,
      DATE_CALL,
      { selector: NEW_DATE_NOW_SELECTOR, message: newDateMessage },
    ],
    '@typescript-eslint/require-array-sort-compare': SORT_COMPARE_RULE,
  };
}
