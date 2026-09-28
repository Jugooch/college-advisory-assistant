/**
 * @file Decides which AI review verdicts still count for a PR's head commit.
 *
 * An APPROVE for commit X also counts for head H when the PR's own change is identical: the
 * `git patch-id --stable` of `git diff $(git merge-base <base> X) X` equals the same for H.
 * A merge from the base branch keeps the patch-id, so approvals carry; any real edit, including
 * one hidden in a merge commit, changes it. A commit that can't be resolved never carries.
 * Only node built-ins are imported: the review workflow runs these scripts without installing.
 * @module scripts/lib/review-carryover
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';

/** Verdict marker that starts every posted review comment. */
const VERDICT_MARKER =
  /^<!-- ai-review reviewer:([a-z-]+) sha:([0-9a-f]{7,40}) verdict:(APPROVE|REQUEST_CHANGES) -->/;

/** Review states that satisfy the gate. */
const PASSING_STATES = new Set(['APPROVE', 'CARRIED']);

/**
 * Runs git with an argument array (never a shell string) and returns stdout.
 *
 * @param {string[]} args - Arguments for `git`.
 * @param {string | undefined} cwd - Repository directory; defaults to the process directory.
 * @param {string} [input] - Text piped to stdin.
 * @returns {string} Command output.
 */
function git(args, cwd, input) {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
}

/**
 * Computes the patch-id of the PR's own change as of one commit.
 *
 * @param {string} sha - Commit to fingerprint (full or abbreviated hex).
 * @param {string} base - Base branch ref, for example `origin/main`.
 * @param {string} [cwd] - Repository directory.
 * @returns {string | null} The stable patch-id, or null when the commit can't be resolved or
 *   the change is empty.
 */
export function computePatchId(sha, base, cwd) {
  // SECURITY: sha only ever comes from VERDICT_MARKER (hex) or the event payload, and git runs
  // without a shell, so neither can inject options or commands.
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    return null;
  }
  try {
    const mergeBase = git(['merge-base', base, `${sha}^{commit}`], cwd).trim();
    const diff = git(['diff', '--no-color', '--no-ext-diff', '--binary', mergeBase, sha], cwd);
    const patchId = git(['patch-id', '--stable'], cwd, diff).trim().split(' ')[0];
    return patchId || null;
  } catch {
    return null;
  }
}

/**
 * Returns the set of comment authors whose verdict markers count.
 *
 * @param {Record<string, string | undefined>} env - Process environment.
 * @returns {Set<string>} Trusted GitHub logins (the Actions bot and the repository owner).
 */
export function trustedAuthors(env) {
  const owner = env.GITHUB_REPOSITORY?.split('/')[0] ?? '';
  return new Set((env.TRUSTED_REVIEW_AUTHORS ?? `github-actions[bot],${owner}`).split(','));
}

/**
 * Finds each reviewer's latest trusted verdict, whatever commit it was for.
 *
 * @param {{ body?: string, user: { login: string } }[]} comments - PR comments, oldest first.
 * @param {Set<string>} trusted - Logins whose markers count.
 * @returns {Map<string, { sha: string, verdict: string }>} Latest verdict per reviewer.
 */
export function latestVerdicts(comments, trusted) {
  const verdicts = new Map();
  for (const comment of comments) {
    const match = comment.body?.match(VERDICT_MARKER);
    if (match && trusted.has(comment.user.login)) {
      verdicts.set(match[1], { sha: match[2], verdict: match[3] });
    }
  }
  return verdicts;
}

/**
 * Resolves whether each required reviewer's latest verdict counts for the head commit.
 *
 * States: APPROVE (on the head), CARRIED (APPROVE on a commit with the head's patch-id),
 * STALE (APPROVE on a commit with a different or unknown change), REQUEST_CHANGES, MISSING.
 *
 * @param {string[]} required - Reviewer agents required for the head's changed files.
 * @param {Map<string, { sha: string, verdict: string }>} verdicts - From `latestVerdicts`.
 * @param {{ headSha: string, base: string, cwd?: string }} context - Head commit and base ref.
 * @returns {{ reviewer: string, state: string, sha: string | null }[]} One row per reviewer.
 */
export function resolveReviewStatus(required, verdicts, context) {
  const patchIds = new Map();
  const patchIdOf = (sha) => {
    if (!patchIds.has(sha)) {
      patchIds.set(sha, computePatchId(sha, context.base, context.cwd));
    }
    return patchIds.get(sha);
  };
  return required.map((reviewer) => {
    const latest = verdicts.get(reviewer);
    if (!latest) {
      return { reviewer, state: 'MISSING', sha: null };
    }
    if (latest.verdict !== 'APPROVE' || context.headSha.startsWith(latest.sha)) {
      return { reviewer, state: latest.verdict, sha: latest.sha };
    }
    const headPatchId = patchIdOf(context.headSha);
    // SAFETY: an unresolvable commit or empty change yields null, and null never matches.
    const isCarried = headPatchId !== null && patchIdOf(latest.sha) === headPatchId;
    return { reviewer, state: isCarried ? 'CARRIED' : 'STALE', sha: latest.sha };
  });
}

/**
 * Lists the reviewers that still need a fresh review of the head commit.
 *
 * @param {{ reviewer: string, state: string }[]} rows - From `resolveReviewStatus`.
 * @returns {string[]} Reviewer names without a current or carried APPROVE, in input order.
 */
export function reviewersNeedingReview(rows) {
  return rows.filter((row) => !PASSING_STATES.has(row.state)).map((row) => row.reviewer);
}

/**
 * Formats one status row for the job log.
 *
 * @param {{ reviewer: string, state: string, sha: string | null }} row - A resolved status.
 * @returns {string} For example `APPROVE (carried from abc1234)  security-reviewer`.
 */
export function formatStatus(row) {
  const short = row.sha?.slice(0, 7);
  const labels = {
    CARRIED: `APPROVE (carried from ${short})`,
    STALE: `STALE (APPROVE on ${short}, change differs)`,
    REQUEST_CHANGES: `REQUEST_CHANGES (on ${short})`,
  };
  return `  ${(labels[row.state] ?? row.state).padEnd(42)} ${row.reviewer}`;
}

/**
 * Reads every comment on a PR, oldest first, through the GitHub CLI.
 *
 * @param {string} repository - `owner/name`.
 * @param {string} prNumber - Pull request number.
 * @returns {{ body?: string, user: { login: string } }[]} The PR's issue comments.
 */
export function fetchPrComments(repository, prNumber) {
  const output = execFileSync(
    'gh',
    ['api', `repos/${repository}/issues/${prNumber}/comments`, '--paginate', '--jq', '.[] | @json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
