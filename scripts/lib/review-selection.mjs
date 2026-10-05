/**
 * @file Decides which reviewer agents must review a set of changed files.
 * @module scripts/lib/review-selection
 * @see docs/standards/08-git-and-pull-requests.md
 */

/** Paths whose changes can affect academic meaning. */
const ACADEMIC_PATHS =
  /^(packages\/(domain|api-contract|engine|db|assistant|test-kit)|apps\/(api|worker)|tests)\//;

/** Paths that contain only tests or test support. */
const TEST_PATHS = /^(tests\/|packages\/test-kit\/)|\.test\.(ts|tsx)$/;

/** UI source files in the web app (components, pages, styles). */
const WEB_UI_PATHS = /^apps\/web\/.*\.(tsx|jsx|css|scss|html)$/;

const isDoc = (path) => path.endsWith('.md');
const isTest = (path) => TEST_PATHS.test(path);

/**
 * Selects the required reviewers for a change.
 *
 * Docs-only PRs get architecture and standards. Test-only PRs get correctness, standards and
 * academic-safety. Everything else gets the full core panel, plus academic-safety for
 * academic paths and accessibility for web UI files.
 *
 * @param {string[]} paths - Repository-relative paths of changed files.
 * @returns {string[]} Reviewer agent names, in a stable order.
 */
export function selectReviewers(paths) {
  if (paths.length > 0 && paths.every(isDoc)) {
    return ['architecture-reviewer', 'standards-reviewer'];
  }
  if (paths.length > 0 && paths.every((path) => isDoc(path) || isTest(path))) {
    return ['standards-reviewer', 'correctness-reviewer', 'academic-safety-reviewer'];
  }
  const reviewers = [
    'architecture-reviewer',
    'standards-reviewer',
    'correctness-reviewer',
    'security-reviewer',
  ];
  if (paths.some((path) => ACADEMIC_PATHS.test(path) && !isDoc(path))) {
    reviewers.push('academic-safety-reviewer');
  }
  if (paths.some((path) => WEB_UI_PATHS.test(path) && !isTest(path))) {
    reviewers.push('accessibility-reviewer');
  }
  return reviewers;
}
