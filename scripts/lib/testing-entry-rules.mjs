/**
 * @file Allowlist for test-only `./testing` package entry points, used by the convention check:
 * only the listed workspaces may export one, and it must point at `./src/testing.ts`.
 * @module scripts/lib/testing-entry-rules
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0009-test-entry-points-allowlist.md
 */
import { posix } from 'node:path';

/** Workspaces that may export `./testing` (standard 01 §Test entry points, ADR-0009). */
export const TESTING_ENTRY_WORKSPACES = ['apps/api', 'apps/worker', 'packages/db'];

/** The only file a `./testing` entry point may resolve to. */
const TESTING_TARGET = './src/testing.ts';

/** Export keys that expose test support: `./testing` itself and any `./testing/...` or `./testing.*`. */
const TESTING_KEY = /^\.\/testing(?:$|[/.])/;

/**
 * Collects every target path in an export value, including conditional (`import`, `types`, ...)
 * and nested condition objects.
 *
 * @param {unknown} value - One `exports` entry.
 * @returns {unknown[]} The leaf targets; anything that isn't a string is returned as-is.
 */
function exportTargets(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).flatMap(exportTargets);
  }
  return Array.isArray(value) ? value.flatMap(exportTargets) : [value];
}

/**
 * Checks one `package.json` for `./testing` export entries that the allowlist doesn't permit.
 *
 * @param {string} path - Repository-relative path of the `package.json`.
 * @param {{ exports?: unknown }} manifest - The parsed file.
 * @returns {string | null} The problem, or null when the file follows the rule.
 */
export function checkTestingExport(path, manifest) {
  const { exports } = manifest;
  if (exports === null || typeof exports !== 'object' || Array.isArray(exports)) {
    return null;
  }
  const keys = Object.keys(exports).filter((key) => TESTING_KEY.test(key));
  if (keys.length === 0) {
    return null;
  }
  const workspace = posix.dirname(path);
  if (!TESTING_ENTRY_WORKSPACES.includes(workspace)) {
    return `only ${TESTING_ENTRY_WORKSPACES.join(', ')} may export ./testing (standard 01, ADR-0009)`;
  }
  const extraKeys = keys.filter((key) => key !== './testing');
  if (extraKeys.length > 0) {
    return `test support is exported only as "./testing", not ${extraKeys.join(', ')}`;
  }
  const targets = exportTargets(/** @type {Record<string, unknown>} */ (exports)['./testing']);
  return targets.every((target) => target === TESTING_TARGET)
    ? null
    : `"./testing" must point to ${TESTING_TARGET} only`;
}
