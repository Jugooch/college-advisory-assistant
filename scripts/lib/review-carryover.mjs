/**
 * @file Decides which AI review verdicts still count for a PR's head commit.
 *
 * An APPROVE for commit X also counts for head H only when every file the PR touches is
 * byte-identical at X and H: the PR's changed paths and change types
 * (`git diff --no-renames --name-status $(git merge-base <base> <sha>) <sha>`) are the same,
 * and each of those paths has the same `git ls-tree` entry (mode and blob, or absent in both).
 * Every other file comes from the already-reviewed base branch. So a merge from the base that
 * leaves the PR's files alone carries approvals, while any edit, rename, mode change, moved
 * block, whitespace change, or base-branch change to a PR file needs a fresh review, as does a
 * commit that can't be resolved.
 * Only node built-ins are imported: the review workflow runs these scripts without installing.
 * @module scripts/lib/review-carryover
 * @see docs/standards/08-git-and-pull-requests.md
 * @see docs/adr/0006-review-approvals-carry-across-base-merges.md
 */
import { execFileSync } from 'node:child_process';

/** Verdict marker that starts every posted review comment. */
const VERDICT_MARKER =
  /^<!-- ai-review reviewer:([a-z-]+) sha:([0-9a-f]{7,40}) verdict:(APPROVE|REQUEST_CHANGES) -->/;

/** Review states that satisfy the gate. */
const PASSING_STATES = new Set(['APPROVE', 'CARRIED']);

/** Largest PR (in touched paths) whose approvals can carry; bigger ones always re-review. */
export const MAX_CARRY_PATHS = 500;

/**
 * Runs git with an argument array (never a shell string) and returns stdout.
 *
 * @param {string[]} args - Arguments for `git`.
 * @param {string | undefined} cwd - Repository directory; defaults to the process directory.
 * @returns {string} Command output.
 */
function git(args, cwd) {
  return execFileSync('git', ['--literal-pathspecs', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * Lists the paths the PR touches as of one commit, with their change type.
 *
 * @param {string} sha - Commit (hex).
 * @param {string} base - Base branch ref.
 * @param {string | undefined} cwd - Repository directory.
 * @returns {string[]} `<status>\t<path>` entries in git's path order.
 */
function listPrChanges(sha, base, cwd) {
  const mergeBase = git(['merge-base', base, `${sha}^{commit}`], cwd).trim();
  const fields = git(
    ['diff', '--no-renames', '--no-relative', '--name-status', '-z', mergeBase, sha],
    cwd,
  ).split('\0');
  const changes = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    changes.push(`${fields[index]}\t${fields[index + 1]}`);
  }
  return changes;
}

/**
 * Fingerprints the PR's own files as of one commit: its changed paths with their change type,
 * plus the tree entry (mode, type, blob) of each of those paths at that commit.
 *
 * @param {string} sha - Commit to fingerprint (full or abbreviated hex).
 * @param {string} base - Base branch ref, for example `origin/main`.
 * @param {string} [cwd] - Repository directory.
 * @returns {string | null} The fingerprint, or null when the commit can't be resolved, the PR
 *   changes nothing, or it touches more than MAX_CARRY_PATHS paths.
 */
export function computeChangeFingerprint(sha, base, cwd) {
  // SECURITY: sha comes from VERDICT_MARKER (hex) or the event payload and is re-checked here.
  // git runs without a shell, NUL-separated output keeps odd path names intact, and
  // --literal-pathspecs stops paths being read as globs or pathspec magic.
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    return null;
  }
  try {
    const changes = listPrChanges(sha, base, cwd);
    if (changes.length === 0 || changes.length > MAX_CARRY_PATHS) {
      return null;
    }
    const paths = changes.map((change) => change.slice(change.indexOf('\t') + 1));
    const entries = git(['ls-tree', '--full-tree', '-z', sha, '--', ...paths], cwd);
    return `${changes.join('\0')}\0\0${entries}`;
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
 * States: APPROVE (on the head), CARRIED (APPROVE on a commit whose PR files are identical to
 * the head's), STALE (APPROVE on a commit whose PR files differ or can't be fingerprinted; the
 * row's `reason` says which), REQUEST_CHANGES, MISSING.
 *
 * @param {string[]} required - Reviewer agents required for the head's changed files.
 * @param {Map<string, { sha: string, verdict: string }>} verdicts - From `latestVerdicts`.
 * @param {{ headSha: string, base: string, cwd?: string }} context - Head commit and base ref.
 * @returns {{ reviewer: string, state: string, sha: string | null, reason?: string }[]} One
 *   row per reviewer.
 */
export function resolveReviewStatus(required, verdicts, context) {
  const fingerprints = new Map();
  const fingerprintOf = (sha) => {
    if (!fingerprints.has(sha)) {
      fingerprints.set(sha, computeChangeFingerprint(sha, context.base, context.cwd));
    }
    return fingerprints.get(sha);
  };
  return required.map((reviewer) => {
    const latest = verdicts.get(reviewer);
    if (!latest) {
      return { reviewer, state: 'MISSING', sha: null };
    }
    if (latest.verdict !== 'APPROVE' || context.headSha.startsWith(latest.sha)) {
      return { reviewer, state: latest.verdict, sha: latest.sha };
    }
    const head = fingerprintOf(context.headSha);
    const approved = fingerprintOf(latest.sha);
    // SAFETY: a commit that can't be fingerprinted yields null, and null never carries.
    if (head === null || approved === null) {
      return { reviewer, state: 'STALE', sha: latest.sha, reason: 'unresolved' };
    }
    return head === approved
      ? { reviewer, state: 'CARRIED', sha: latest.sha }
      : { reviewer, state: 'STALE', sha: latest.sha, reason: 'files differ' };
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
 * @param {{ reviewer: string, state: string, sha: string | null, reason?: string }} row - A
 *   resolved status.
 * @returns {string} For example `APPROVE (carried from abc1234)  security-reviewer`.
 */
export function formatStatus(row) {
  const short = row.sha?.slice(0, 7);
  const labels = {
    CARRIED: `APPROVE (carried from ${short})`,
    STALE: `STALE (APPROVE on ${short}, ${row.reason})`,
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
function fetchPrComments(repository, prNumber) {
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

/**
 * Resolves the required reviewers' status for a PR head from its trusted verdict comments.
 * The review workflow's `select` and `gate` jobs both call this, so they apply one rule.
 *
 * @param {string[]} required - Reviewer agents required for the head's changed files.
 * @param {{ repository: string, prNumber: string, headSha: string, base: string }} pr - The PR,
 *   its head commit, and the base branch ref (for example `origin/main`).
 * @param {Record<string, string | undefined>} env - Process environment, for trusted authors.
 * @returns {{ reviewer: string, state: string, sha: string | null }[]} One row per reviewer.
 */
export function resolvePrReviewStatus(required, pr, env) {
  const verdicts = latestVerdicts(fetchPrComments(pr.repository, pr.prNumber), trustedAuthors(env));
  return resolveReviewStatus(required, verdicts, { headSha: pr.headSha, base: pr.base });
}
