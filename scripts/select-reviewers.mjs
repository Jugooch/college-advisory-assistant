/**
 * @file Prints the reviewer agents that must review the current branch as a JSON array.
 *
 * Usage: `node scripts/select-reviewers.mjs [base-ref]` (default base `main`).
 * With PR_NUMBER, HEAD_SHA and GITHUB_REPOSITORY set (as in the review workflow), it drops
 * reviewers whose latest trusted verdict already approves the head or carries to it, using the
 * same rule as the gate. In GitHub Actions it also writes `reviewers=<json>` to $GITHUB_OUTPUT.
 * @module scripts/select-reviewers
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

import { parseAgentModel } from './lib/agent-model.mjs';
import {
  formatStatus,
  resolvePrReviewStatus,
  reviewersNeedingReview,
} from './lib/review-carryover.mjs';
import { selectReviewers } from './lib/review-selection.mjs';

const baseRef = process.argv[2] ?? 'main';
const { PR_NUMBER, HEAD_SHA, GITHUB_REPOSITORY } = process.env;
const diff = execFileSync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
  encoding: 'utf8',
});
let reviewers = selectReviewers(diff.split('\n').filter(Boolean));

if (PR_NUMBER && HEAD_SHA && GITHUB_REPOSITORY) {
  const rows = resolvePrReviewStatus(
    reviewers,
    {
      repository: GITHUB_REPOSITORY,
      prNumber: PR_NUMBER,
      headSha: HEAD_SHA,
      base: `origin/${baseRef}`,
    },
    process.env,
  );
  console.log(`Required reviewers for ${HEAD_SHA.slice(0, 7)}:`);
  rows.forEach((row) => console.log(formatStatus(row)));
  reviewers = reviewersNeedingReview(rows);
}

const output = JSON.stringify(reviewers);
console.log(output);
// Models come from each agent file's frontmatter so it stays the single source of truth.
const models = Object.fromEntries(
  reviewers.map((name) => {
    const model = parseAgentModel(readFileSync(`.claude/agents/${name}.md`, 'utf8'));
    if (!model) throw new Error(`${name}: no model in .claude/agents/${name}.md frontmatter`);
    return [name, model];
  }),
);
console.log(JSON.stringify(models));
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `reviewers=${output}\nmodels=${JSON.stringify(models)}\n`,
  );
}
