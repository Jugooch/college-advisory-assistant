/**
 * @file Prints the reviewer agents required for the current branch as a JSON array.
 *
 * Usage: `node scripts/select-reviewers.mjs [base-ref]` (default base `main`).
 * In GitHub Actions it also writes `reviewers=<json>` to $GITHUB_OUTPUT.
 * @module scripts/select-reviewers
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

import { selectReviewers } from './lib/review-selection.mjs';

const baseRef = process.argv[2] ?? 'main';
const diff = execFileSync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
  encoding: 'utf8',
});
const reviewers = JSON.stringify(selectReviewers(diff.split('\n').filter(Boolean)));

console.log(reviewers);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `reviewers=${reviewers}\n`);
}
