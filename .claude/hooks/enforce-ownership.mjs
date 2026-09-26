/**
 * @file PreToolUse hook: blocks a team agent from editing files outside its ownership area.
 *
 * Claude Code passes `agent_type` when a subagent makes the call. The main session and
 * non-team agents are not restricted here; CI still enforces ownership per branch.
 * @module .claude/hooks/enforce-ownership
 * @see docs/team/README.md
 */
import { loadOwnership, mayChange, ownerOf, toRepoPath } from '../../scripts/lib/ownership.mjs';

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

/**
 * Prints a deny decision and exits.
 *
 * @param {string} reason - Explanation returned to the agent.
 */
function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

const input = JSON.parse(await readStdin());
const agent = input.agent_type;
const ownership = loadOwnership();
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

if (agent && ownership.reviewers.includes(agent)) {
  deny(`${agent} is a reviewer and may not modify files. Report findings instead.`);
}

if (agent && agent in ownership.owners && target) {
  const repoPath = toRepoPath(target);
  if (!repoPath.startsWith('..') && !mayChange(ownership, agent, repoPath)) {
    const owner = ownerOf(ownership, repoPath) ?? 'no one (ask the tech lead)';
    deny(`${repoPath} belongs to ${owner}, not ${agent}. Hand this change off to its owner.`);
  }
}
