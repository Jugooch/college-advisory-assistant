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
  pnpm: /^vitest run\b/,
  ls: null,
  cat: null,
  head: null,
  tail: null,
  wc: null,
  grep: null,
};

const FORBIDDEN_PATTERNS = [
  { pattern: /\$\(|`/, reason: 'command substitution is not allowed' },
  {
    pattern: /(^|[^0-9&])>{1,2}(?!&1|\s*\/dev\/null)/,
    reason: 'output redirection is not allowed; use the Write/Edit tools',
  },
  { pattern: /(^|[\s/'"])\.env(\.|\b)/, reason: '.env files may not be read' },
  { pattern: /\bpush\b.*(--force|-f\b)/, reason: 'force-push is not allowed' },
  {
    pattern: /\b(tee|sed\s+-i|cp|mv|rm|chmod|curl|wget|dd|ln)\b/,
    reason: 'file-mutating or network commands are not allowed',
  },
];

/**
 * Removes heredoc bodies and quoted strings so their text isn't mistaken for shell syntax.
 *
 * @param {string} command - Raw command.
 * @returns {string} Command with literals blanked out.
 */
function stripLiterals(command) {
  return command
    .replace(/<<-?\s*'?(\w+)'?[^\n]*\n[\s\S]*?\n\s*\1\s*(\n|$)/g, ' HEREDOC ')
    .replace(/'[^']*'/g, "''")
    .replace(/"(\\.|[^"\\])*"/g, '""');
}

/**
 * Checks a command against the allowlist for a role.
 *
 * @param {string} command - Shell command from the Bash tool.
 * @param {'builder' | 'reviewer'} role - Kind of team agent.
 * @returns {string | null} Reason for denial, or null when the command is allowed.
 */
export function checkCommand(command, role) {
  const code = stripLiterals(command);
  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(code));
  if (forbidden) {
    return forbidden.reason;
  }
  const allowed = role === 'reviewer' ? REVIEWER_COMMANDS : BUILDER_COMMANDS;
  for (const segment of code.split(/&&|\|\||;|\||\n/)) {
    const [program = '', ...rest] = segment
      .trim()
      .replace(/^(\w+=\S*\s+)+/, '')
      .split(/\s+/);
    if (program === '' || program === 'HEREDOC') continue;
    const subcommand = rest.join(' ');
    if (!(program in allowed)) return `"${program}" is not on the ${role} command allowlist`;
    const rule = allowed[program];
    if (rule && !rule.test(subcommand))
      return `"${program} ${subcommand}" is not allowed for ${role}s`;
  }
  return null;
}
