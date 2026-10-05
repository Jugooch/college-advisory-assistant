/**
 * @file Reads the `model:` value from an agent file's frontmatter.
 * @module scripts/lib/agent-model
 * @see docs/standards/08-git-and-pull-requests.md
 */

const ALLOWED_MODELS = /^(opus|sonnet|haiku)$/;

/**
 * Extracts the model alias from agent markdown frontmatter.
 *
 * @param {string} markdown - Full text of a `.claude/agents/<name>.md` file.
 * @returns {string | undefined} The model alias, or undefined when absent.
 * @throws {Error} When the value is not exactly opus, sonnet or haiku.
 */
export function parseAgentModel(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return undefined;
  const line = /^model:[ \t]*(.+?)[ \t]*$/m.exec(match[1]);
  if (!line) return undefined;
  const value = line[1].replace(/^(['"])(.*)\1$/, '$2');
  if (!ALLOWED_MODELS.test(value)) {
    throw new Error(`Unsupported agent model "${value}"; expected opus, sonnet or haiku.`);
  }
  return value;
}
