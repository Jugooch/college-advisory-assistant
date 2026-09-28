/**
 * @file Placement rule for the `'use server'` directive in the web app, used by the
 * convention check: server actions live only in `features/<feature>/actions/*.action.ts`,
 * and each of those files starts with the directive.
 * @module scripts/lib/server-directive-rules
 * @see docs/standards/06-frontend.md
 * @see docs/adr/0007-web-shared-tier-and-server-actions.md
 */

/** Non-test web source files, the only files this rule reads. */
const WEB_SOURCE = /^apps\/web\/src\/.+\.tsx?$/;
/** Test files are exempt; they may mention the directive in fixtures. */
const TEST_FILE = /\.test\.tsx?$/;
/** A server action file (standard 06 §Server actions). */
const ACTION_FILE = /^apps\/web\/src\/features\/[a-z0-9-]+\/actions\/[^/]+\.action\.ts$/;
/** A `'use server'` directive on its own line, at file level or in a function body. */
const DIRECTIVE_LINE = /^\s*(['"])use server\1;?\s*$/m;
/** Leading whitespace and comments, such as the `@file` header. */
const LEADING_COMMENTS = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;
/** The directive as the first statement. */
const LEADING_DIRECTIVE = /^(['"])use server\1;?[ \t]*(\r?\n|$)/;

/**
 * Checks where `'use server'` appears in one file.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - File contents.
 * @returns {string | null} A problem description, or null when the file follows the rule.
 */
export function checkServerDirective(path, source) {
  if (!WEB_SOURCE.test(path) || TEST_FILE.test(path)) {
    return null;
  }
  if (ACTION_FILE.test(path)) {
    const body = source.replace(LEADING_COMMENTS, '');
    return LEADING_DIRECTIVE.test(body) ? null : "server action files start with 'use server'";
  }
  // SECURITY: every server action is a public POST endpoint, so actions must stay in the one
  // folder reviewers and lint know to treat as endpoints.
  return DIRECTIVE_LINE.test(source)
    ? 'server actions live in features/<feature>/actions/*.action.ts'
    : null;
}
