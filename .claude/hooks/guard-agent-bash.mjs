/**
 * @file PreToolUse hook: restricts team agents' shell commands to their role's allowlist.
 *
 * The main session and non-team agents are not restricted here.
 * @module .claude/hooks/guard-agent-bash
 * @see docs/team/README.md
 */
import { checkCommand } from '../../scripts/lib/bash-guard.mjs';
import { loadOwnership } from '../../scripts/lib/ownership.mjs';

/**
 * Reads all of stdin.
 *
 * @returns {Promise<string>} The raw hook input.
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const input = JSON.parse(await readStdin());
const agent = input.agent_type;
const ownership = loadOwnership();
const role = ownership.reviewers.includes(agent)
  ? 'reviewer'
  : agent in ownership.owners
    ? 'builder'
    : null;

if (role) {
  const reason = checkCommand(input.tool_input?.command ?? '', role);
  if (reason) {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${agent}: ${reason}. See docs/team/README.md for allowed commands.`,
      },
    };
    process.stdout.write(JSON.stringify(output));
  }
}
