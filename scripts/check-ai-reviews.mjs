/**
 * @file AI review gate: passes only when every required reviewer's latest verdict approves the
 * PR's head commit, or approves an earlier commit whose PR change is identical (same patch-id).
 *
 * Reads verdict markers of the form
 * `<!-- ai-review reviewer:<name> sha:<sha> verdict:<APPROVE|REQUEST_CHANGES> -->`
 * from PR comments written by trusted authors (the Actions bot and the repository owner).
 * Needs full git history and the base branch fetched as `origin/<BASE_REF>`.
 * Required env: PR_NUMBER, HEAD_SHA, BASE_REF, GITHUB_REPOSITORY.
 * Optional: TRUSTED_REVIEW_AUTHORS (comma-separated).
 * @module scripts/check-ai-reviews
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';

import {
  fetchPrComments,
  formatStatus,
  latestVerdicts,
  resolveReviewStatus,
  reviewersNeedingReview,
  trustedAuthors,
} from './lib/review-carryover.mjs';
import { selectReviewers } from './lib/review-selection.mjs';

const { PR_NUMBER, HEAD_SHA, BASE_REF, GITHUB_REPOSITORY } = process.env;

const files = execFileSync(
  'gh',
  ['pr', 'diff', PR_NUMBER, '--name-only', '--repo', GITHUB_REPOSITORY],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
)
  .split('\n')
  .filter(Boolean);
const required = selectReviewers(files);
const verdicts = latestVerdicts(
  fetchPrComments(GITHUB_REPOSITORY, PR_NUMBER),
  trustedAuthors(process.env),
);
const rows = resolveReviewStatus(required, verdicts, {
  headSha: HEAD_SHA,
  base: `origin/${BASE_REF}`,
});

console.log(`Required reviewers for ${HEAD_SHA.slice(0, 7)}:`);
rows.forEach((row) => console.log(formatStatus(row)));

const failing = reviewersNeedingReview(rows);
if (failing.length > 0) {
  console.error(`AI review gate failed: ${failing.join(', ')} not approved.`);
  process.exit(1);
}
console.log('AI review gate passed.');
