/**
 * @file Posts a reviewer agent's final output as a PR comment after validating its verdict marker.
 *
 * Reviewers never post themselves. This step runs in trusted workflow code, so a reviewer that
 * fails, times out, or returns a malformed review fails its job loudly instead of silently.
 * Required env: EXECUTION_FILE, REVIEWER, HEAD_SHA, PR_NUMBER, GITHUB_REPOSITORY.
 * @module scripts/post-ai-review
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { EXECUTION_FILE, REVIEWER, HEAD_SHA, PR_NUMBER, GITHUB_REPOSITORY } = process.env;

/**
 * Reads the reviewer's final message from the Claude Code execution log.
 *
 * @param {string | undefined} path - Path to the execution JSON file.
 * @returns {string} The final result text, or an empty string when absent.
 */
function readFinalResult(path) {
  if (!path) {
    return '';
  }
  const messages = JSON.parse(readFileSync(path, 'utf8'));
  const result = messages.findLast((message) => message.type === 'result');
  return typeof result?.result === 'string' ? result.result : '';
}

const output = readFinalResult(EXECUTION_FILE);
const marker = new RegExp(
  `<!-- ai-review reviewer:${REVIEWER} sha:${HEAD_SHA} verdict:(APPROVE|REQUEST_CHANGES) -->`,
);
const start = output.search(marker);

if (start === -1) {
  console.error(`${REVIEWER} did not return a review with a valid verdict marker for ${HEAD_SHA}.`);
  console.error(`Final output (first 2,000 characters):\n${output.slice(0, 2000) || '(empty)'}`);
  process.exit(1);
}

const review = output.slice(start).replace(/\n```\s*$/, '');
execFileSync('gh', ['pr', 'comment', PR_NUMBER, '--repo', GITHUB_REPOSITORY, '--body-file', '-'], {
  input: review,
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log(`Posted ${REVIEWER} verdict: ${review.match(marker)?.[1]}.`);
