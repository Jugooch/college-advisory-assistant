/**
 * @file Reads the `model:` value from an agent file's frontmatter.
 * @module scripts/lib/agent-model
 * @see docs/standards/08-git-and-pull-requests.md
 */

/**
 * Extracts the model alias from agent markdown frontmatter.
 *
 * @param {string} markdown - Full text of a `.claude/agents/<name>.md` file.
 * @returns {string | undefined} The model alias, or undefined when absent.
 */
export function parseAgentModel(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return undefined;
  const line = /^model:[ \t]*(.+?)[ \t]*$/m.exec(match[1]);
  return line ? line[1].replace(/^(['"])(.*)\1$/, '$2') : undefined;
}
