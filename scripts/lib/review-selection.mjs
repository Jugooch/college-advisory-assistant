/**
 * @file Decides which reviewer agents must review a set of changed files.
 * @module scripts/lib/review-selection
 * @see docs/standards/08-git-and-pull-requests.md
 */

/** Paths whose changes can affect academic meaning. */
const ACADEMIC_PATHS =
  /^(packages\/(domain|api-contract|engine|db|assistant|test-kit)|apps\/(api|worker)|tests)\//;

/**
 * Selects the required reviewers for a change.
 *
 * @param {string[]} paths - Repository-relative paths of changed files.
 * @returns {string[]} Reviewer agent names, in a stable order.
 */
export function selectReviewers(paths) {
  const isDocsOnly = paths.length > 0 && paths.every((path) => path.endsWith('.md'));
  const reviewers = ['architecture-reviewer', 'standards-reviewer'];
  if (!isDocsOnly) {
    reviewers.push('correctness-reviewer', 'security-reviewer');
  }
  if (paths.some((path) => ACADEMIC_PATHS.test(path) && !path.endsWith('.md'))) {
    reviewers.push('academic-safety-reviewer');
  }
  if (paths.some((path) => path.startsWith('apps/web/') && !path.endsWith('.md'))) {
    reviewers.push('accessibility-reviewer');
  }
  return reviewers;
}
