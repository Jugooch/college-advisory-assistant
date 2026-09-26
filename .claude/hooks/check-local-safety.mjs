/**
 * @file SessionStart hook: warns when this machine's agent shells are less contained than ADR-0003 expects.
 *
 * Credential-store denies and the sandbox toggle live in per-machine settings, so nothing in the
 * repository can enforce them. This hook makes a missing setup step visible at the start of every session.
 * @module .claude/hooks/check-local-safety
 * @see docs/team/README.md
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Reads a JSON settings file, treating a missing or invalid file as empty.
 *
 * @param {string} path - Absolute path to the settings file.
 * @returns {Record<string, any>} Parsed settings, or an empty object.
 */
function readSettings(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const local = readSettings(join(projectDir, '.claude', 'settings.local.json'));
const user = readSettings(join(homedir(), '.claude', 'settings.json'));
const setup = 'See "Sandbox setup" in docs/team/README.md.';

let warning = null;
if (local.sandbox?.enabled === false) {
  warning =
    'Agent shell sandbox is OFF on this machine (.claude/settings.local.json). Agent Bash commands run with ' +
    `your full permissions: they can read credentials in your home directory and reach any network host. ${setup}`;
} else if (!(user.sandbox?.filesystem?.denyRead?.length > 0)) {
  warning =
    'No credential-store read denies in your user settings (~/.claude/settings.json), so sandboxed agent ' +
    `commands can read SSH keys, cloud CLI credentials, and npm tokens. ${setup}`;
}

if (warning) {
  process.stdout.write(JSON.stringify({ systemMessage: warning }));
}
