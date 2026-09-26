/**
 * @file AI review gate: passes only when every required reviewer approved the PR's current head commit.
 *
 * Reads verdict markers of the form
 * `<!-- ai-review reviewer:<name> sha:<sha> verdict:<APPROVE|REQUEST_CHANGES> -->`
 * from PR comments written by trusted authors (the Actions bot and the repository owner).
 * Required env: PR_NUMBER, HEAD_SHA, GITHUB_REPOSITORY. Optional: TRUSTED_REVIEW_AUTHORS (comma-separated).
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';

import { selectReviewers } from './lib/review-selection.mjs';

const MARKER =
  /^<!-- ai-review reviewer:([a-z-]+) sha:([0-9a-f]{7,40}) verdict:(APPROVE|REQUEST_CHANGES) -->/;
const { PR_NUMBER, HEAD_SHA, GITHUB_REPOSITORY } = process.env;
const owner = GITHUB_REPOSITORY?.split('/')[0] ?? '';
const trusted = new Set(
  (process.env.TRUSTED_REVIEW_AUTHORS ?? `github-actions[bot],${owner}`).split(','),
);

/**
 * Runs the GitHub CLI and returns stdout.
 *
 * @param {string[]} args - Arguments for `gh`.
 * @returns {string} Command output.
 */
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const files = gh(['pr', 'diff', PR_NUMBER, '--name-only', '--repo', GITHUB_REPOSITORY])
  .split('\n')
  .filter(Boolean);
const required = selectReviewers(files);
const comments = gh([
  'api',
  `repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments`,
  '--paginate',
  '--jq',
  '.[] | @json',
])
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

/** Latest verdict per reviewer for the current head commit. */
const verdicts = new Map();
for (const comment of comments) {
  const match = comment.body?.match(MARKER);
  const isCurrent = match && HEAD_SHA.startsWith(match[2]);
  if (isCurrent && trusted.has(comment.user.login)) {
    verdicts.set(match[1], match[3]);
  }
}

const rows = required.map((reviewer) => [reviewer, verdicts.get(reviewer) ?? 'MISSING']);
console.log(`Required reviewers for ${HEAD_SHA.slice(0, 7)}:`);
rows.forEach(([reviewer, verdict]) => console.log(`  ${verdict.padEnd(16)} ${reviewer}`));

const failing = rows.filter(([, verdict]) => verdict !== 'APPROVE');
if (failing.length > 0) {
  console.error(
    `AI review gate failed: ${failing.map(([reviewer]) => reviewer).join(', ')} not approved.`,
  );
  process.exit(1);
}
console.log('AI review gate passed.');
