/**
 * @file Decides whether a PR body links the authorization an `ownership-override` PR needs:
 * "authorized by" followed by a tech-lead issue or an ADR (standard 08, Ownership overrides).
 * @module scripts/lib/override-authorization
 * @see docs/standards/08-git-and-pull-requests.md
 */

/** HTML comments, which hold the PR template's instructions rather than the author's text. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * What may follow "authorized by": `#108`, `ADR-0004`, a GitHub issue URL, or a path or link to
 * `docs/adr/NNNN-*.md`, optionally inside a Markdown link's text or target.
 */
const AUTHORIZING_REFERENCE = String.raw`\[?(?:#\d+\b|ADR-\d{4}\b|https://github\.com/[\w.-]+/[\w.-]+/issues/\d+\b|\S*docs/adr/\d{4}-[\w-]+\.md)`;

/** "authorized by" (or "authorised by") directly followed by an authorizing reference. */
const AUTHORIZATION = new RegExp(String.raw`\bauthori[sz]ed by\s+${AUTHORIZING_REFERENCE}`, 'i');

/**
 * Checks whether a PR body names what authorizes its ownership override.
 *
 * @param {string | undefined} body - The PR description; undefined or empty when there is none.
 * @returns {boolean} True when the body, outside HTML comments, says "authorized by" followed by
 *   an issue number, an issue URL, or an ADR.
 */
export function hasOverrideAuthorization(body) {
  return AUTHORIZATION.test((body ?? '').replace(HTML_COMMENT, ''));
}
