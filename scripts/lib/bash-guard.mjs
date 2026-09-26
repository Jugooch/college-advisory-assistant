/**
 * @file Decides whether a team agent may run a shell command.
 *
 * This is an allowlist, not a sandbox: it keeps agents to the commands their workflow needs so
 * the shell can't be used to edit files outside their area. CI's ownership check remains the
 * backstop for anything that reaches git.
 * @module scripts/lib/bash-guard
 * @see docs/team/README.md
 */

/** Programs every builder may run, with the subcommands allowed where it matters. */
const BUILDER_COMMANDS = {
  pnpm: null,
  node: /^scripts\//,
  npx: /^(eslint|prettier|vitest|tsc|drizzle-kit)\b/,
  git: /^(status|diff|log|show|rev-parse|branch|switch|checkout|add|commit|push|pull|fetch|restore|stash|ls-files|grep)\b/,
  gh: /^(pr (create|view|diff|checks|comment|list)|issue (view|list)|run (view|list))\b/,
  ls: null,
  cat: null,
  head: null,
  tail: null,
  wc: null,
  grep: null,
  sort: null,
  uniq: null,
  diff: null,
  pwd: null,
  echo: null,
  printf: null,
  cd: null,
  true: null,
};

/** Programs reviewers may run: inspection only. */
const REVIEWER_COMMANDS = {
  git: /^(status|diff|log|show|rev-parse|ls-files|grep)\b/,
  gh: /^(pr (view|diff|checks|comment|list)|run (view|list))\b/,
  ls: null,
  cat: null,
  head: null,
  tail: null,
  wc: null,
  grep: null,
};

/** Checked against every character bash could expand (everything outside single quotes). */
const FORBIDDEN_PATTERNS = [
  { pattern: /[$`]/, reason: 'variable expansion and command substitution are not allowed' },
  { pattern: /[<>]\(/, reason: 'process substitution is not allowed' },
  {
    pattern: />{1,2}(?!&\d)(?!\s*\/dev\/null\b)/,
    reason: 'output redirection is not allowed; use the Write/Edit tools',
  },
  { pattern: /(^|[\s/'"=])\.env(\.|\b)/, reason: '.env files may not be read' },
  { pattern: /\bpush\b.*(--force|-f\b)/, reason: 'force-push is not allowed' },
  {
    pattern: /\b(tee|sed\s+-i|cp|mv|rm|chmod|curl|wget|dd|ln|eval|exec|source|sh|bash)\b/,
    reason: 'file-mutating, network, or nested-shell commands are not allowed',
  },
];

/** A heredoc whose delimiter is quoted, so bash expands nothing in its body. */
const QUOTED_HEREDOC = /^<<-?[ \t]*(['"])(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/;

/**
 * Consumes input outside any quotes.
 *
 * @param {{ expandable: string, structure: string, quote: string | null }} state - Scanner state.
 * @param {string} command - Raw command.
 * @param {number} index - Position to read.
 * @returns {number} Characters consumed.
 */
function consumeUnquoted(state, command, index) {
  const heredoc = command.slice(index).match(QUOTED_HEREDOC);
  if (heredoc) {
    state.structure += ' HEREDOC ';
    return heredoc[0].length;
  }
  const char = command[index];
  if (char === "'" || char === '"') {
    state.quote = char;
    state.structure += ' ';
    return 1;
  }
  const text = char === '\\' ? command.slice(index, index + 2) : char;
  state.expandable += text;
  state.structure += char === '\\' ? '__' : char;
  return text.length;
}

/**
 * Consumes input inside single or double quotes.
 *
 * @param {{ expandable: string, structure: string, quote: string | null }} state - Scanner state.
 * @param {string} command - Raw command.
 * @param {number} index - Position to read.
 * @returns {number} Characters consumed.
 */
function consumeQuoted(state, command, index) {
  const char = command[index];
  if (char === state.quote) {
    state.quote = null;
    state.structure += ' ';
    return 1;
  }
  // NOTE: bash expands nothing inside single quotes, so that text is never scanned.
  if (state.quote === "'") {
    return 1;
  }
  const text = char === '\\' ? command.slice(index, index + 2) : char;
  state.expandable += text;
  return text.length;
}

/**
 * Splits a command the way bash reads quotes.
 *
 * @param {string} command - Raw command.
 * @returns {{ expandable: string, structure: string } | null} `expandable` is every character bash
 *   may expand (all text outside single quotes and quoted heredocs); `structure` is the command with
 *   all quoted text removed, used to find programs. Null when quotes are unbalanced.
 */
function scanQuotes(command) {
  const state = { expandable: '', structure: '', quote: null };
  let index = 0;
  while (index < command.length) {
    const consume = state.quote === null ? consumeUnquoted : consumeQuoted;
    index += consume(state, command, index);
  }
  return state.quote === null ? { expandable: state.expandable, structure: state.structure } : null;
}

/**
 * Checks one simple command (no operators) against a role's allowlist.
 *
 * @param {string} segment - One command from the pipeline or list.
 * @param {'builder' | 'reviewer'} role - Kind of team agent.
 * @returns {string | null} Reason for denial, or null when allowed.
 */
function checkSegment(segment, role) {
  const allowed = role === 'reviewer' ? REVIEWER_COMMANDS : BUILDER_COMMANDS;
  const [program = '', ...rest] = segment
    .trim()
    .replace(/^(\w+=\S*\s+)+/, '')
    .split(/\s+/);
  if (program === '' || program === 'HEREDOC') {
    return null;
  }
  if (!(program in allowed)) {
    return `"${program}" is not on the ${role} command allowlist`;
  }
  const rule = allowed[program];
  const subcommand = rest.join(' ');
  return rule && !rule.test(subcommand)
    ? `"${program} ${subcommand}" is not allowed for ${role}s`
    : null;
}

/**
 * Checks a command against the allowlist for a role.
 *
 * @param {string} command - Shell command from the Bash tool.
 * @param {'builder' | 'reviewer'} role - Kind of team agent.
 * @returns {string | null} Reason for denial, or null when the command is allowed.
 */
export function checkCommand(command, role) {
  const scanned = scanQuotes(command);
  if (scanned === null) {
    return 'unbalanced quotes';
  }
  // SECURITY: scan everything bash could expand, including double-quoted text.
  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(scanned.expandable));
  if (forbidden) {
    return forbidden.reason;
  }
  const segments = scanned.structure.split(/&&|\|\||;|\||(?<![<>])&(?!>)|\n/);
  return segments.map((segment) => checkSegment(segment, role)).find((reason) => reason) ?? null;
}
