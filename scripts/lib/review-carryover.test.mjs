/**
 * @file Tests for carrying AI review approvals across commits whose PR-touched files are
 * identical, using a throwaway git repository built in a temporary directory.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildScenarioRepo, UNKNOWN_SHA } from '../test/review-scenario-repo.mjs';
import { removeTempDir } from '../test/temp-git-repo.mjs';
import {
  computeChangeFingerprint,
  formatStatus,
  latestVerdicts,
  resolveReviewStatus,
  reviewersNeedingReview,
  trustedAuthors,
} from './review-carryover.mjs';
const TRUSTED = new Set(['github-actions[bot]', 'owner']);

let dir = '';
/** Commits in the scenario repository, by role. */
let shas = {};

/**
 * Builds a verdict comment.
 *
 * @param {string} reviewer - Reviewer agent name.
 * @param {string} sha - Reviewed commit.
 * @param {string} verdict - APPROVE or REQUEST_CHANGES.
 * @returns {{ body: string, user: { login: string } }} A PR comment by the Actions bot.
 */
function verdictComment(reviewer, sha, verdict) {
  const body = `<!-- ai-review reviewer:${reviewer} sha:${sha} verdict:${verdict} -->\nReview.`;
  return { body, user: { login: 'github-actions[bot]' } };
}

/**
 * Re-attributes a comment to an author outside the trusted set.
 *
 * @param {{ body: string, user: { login: string } }} comment - A PR comment.
 * @returns {{ body: string, user: { login: string } }} The same body by `someone-else`.
 */
function byUntrustedAuthor(comment) {
  return { ...comment, user: { login: 'someone-else' } };
}
beforeAll(() => {
  ({ dir, shas } = buildScenarioRepo());
});

afterAll(() => {
  removeTempDir(dir);
});

describe('computeChangeFingerprint', () => {
  /**
   * Fingerprints a scenario commit against `main`.
   *
   * @param {string} sha - Commit.
   * @returns {string | null} The fingerprint.
   */
  const fingerprint = (sha) => computeChangeFingerprint(sha, 'main', dir);

  it('matches after merging a base that changed only files outside the PR', () => {
    const approved = fingerprint(shas.approved);

    expect(approved).toContain('sep.mjs');
    expect(fingerprint(shas.cleanMerge)).toBe(approved);
  });

  it('accepts an abbreviated sha', () => {
    expect(fingerprint(shas.approved.slice(0, 7))).toBe(fingerprint(shas.approved));
  });

  it.each([
    ['a merge commit sneaks in an extra change', 'evilMerge'],
    ['the PR edits its own files', 'edited'],
    ['the PR changes only whitespace inside a string literal', 'stringWhitespace'],
    ['the PR changes only YAML indentation', 'yamlIndent'],
    ['an identical block moves within a PR file', 'movedBlock'],
    ['a PR file is only renamed', 'renamed'],
    ['a PR file only changes mode', 'modeOnly'],
  ])('differs when %s', (_, head) => {
    const approved = fingerprint(shas.approved);

    expect(fingerprint(shas[head])).not.toBe(approved);
  });

  it('differs when the base branch changes a PR-touched file', () => {
    const approved = computeChangeFingerprint(shas.approved, 'main-touches-pr', dir);

    expect(computeChangeFingerprint(shas.baseTouch, 'main-touches-pr', dir)).not.toBe(approved);
  });

  it('returns null for a commit that is not in the repository', () => {
    expect(fingerprint(UNKNOWN_SHA)).toBeNull();
  });

  it('returns null for a value that is not a hex sha', () => {
    expect(fingerprint('--output=/tmp/x')).toBeNull();
  });

  it('returns null when the commit has no change against the base', () => {
    expect(fingerprint(shas.base)).toBeNull();
  });

  it('returns null when the PR touches more paths than the carry-over cap', () => {
    expect(fingerprint(shas.huge)).toBeNull();
  });
});

describe('latestVerdicts', () => {
  it('keeps the latest verdict per reviewer across commits', () => {
    const comments = [
      verdictComment('security-reviewer', shas.approved, 'APPROVE'),
      verdictComment('security-reviewer', shas.edited, 'REQUEST_CHANGES'),
    ];

    const verdicts = latestVerdicts(comments, TRUSTED);

    expect(verdicts.get('security-reviewer')).toEqual({
      sha: shas.edited,
      verdict: 'REQUEST_CHANGES',
    });
  });

  it('ignores markers from untrusted authors', () => {
    const comments = [
      verdictComment('security-reviewer', shas.approved, 'REQUEST_CHANGES'),
      byUntrustedAuthor(verdictComment('security-reviewer', shas.cleanMerge, 'APPROVE')),
    ];

    const verdicts = latestVerdicts(comments, TRUSTED);

    expect(verdicts.get('security-reviewer')?.verdict).toBe('REQUEST_CHANGES');
  });

  it('ignores comments without a marker at the start', () => {
    const quoted = `> ${verdictComment('security-reviewer', shas.approved, 'APPROVE').body}`;

    const verdicts = latestVerdicts([{ body: quoted, user: { login: 'owner' } }], TRUSTED);

    expect(verdicts.size).toBe(0);
  });
});

describe('trustedAuthors', () => {
  it('trusts the Actions bot and the repository owner by default', () => {
    const trusted = trustedAuthors({ GITHUB_REPOSITORY: 'owner/repo' });

    expect([...trusted]).toEqual(['github-actions[bot]', 'owner']);
  });
});

describe('resolveReviewStatus', () => {
  /**
   * Resolves one reviewer's status against a head commit.
   *
   * @param {{ body: string, user: { login: string } }[]} comments - PR comments, oldest first.
   * @param {string} headSha - Head commit.
   * @returns {{ reviewer: string, state: string, sha: string | null }} The reviewer's row.
   */
  function resolveOne(comments, headSha) {
    const verdicts = latestVerdicts(comments, TRUSTED);
    return resolveReviewStatus(['security-reviewer'], verdicts, {
      headSha,
      base: 'main',
      cwd: dir,
    })[0];
  }

  it('passes an APPROVE on the head commit, including an abbreviated sha', () => {
    const row = resolveOne(
      [verdictComment('security-reviewer', shas.cleanMerge.slice(0, 7), 'APPROVE')],
      shas.cleanMerge,
    );

    expect(row.state).toBe('APPROVE');
  });

  it('carries an APPROVE across a clean merge from the base', () => {
    const row = resolveOne(
      [verdictComment('security-reviewer', shas.approved, 'APPROVE')],
      shas.cleanMerge,
    );

    expect(row).toEqual({ reviewer: 'security-reviewer', state: 'CARRIED', sha: shas.approved });
    expect(reviewersNeedingReview([row])).toEqual([]);
  });

  it.each([
    ['a merge commit with an extra change', 'evilMerge'],
    ['an edit to the PR files', 'edited'],
    ['a whitespace-only edit inside a string literal', 'stringWhitespace'],
    ['a whitespace-only YAML indentation change', 'yamlIndent'],
    ['an identical block moved within a PR file', 'movedBlock'],
    ['a pure rename', 'renamed'],
    ['a mode-only change', 'modeOnly'],
  ])('does not carry an APPROVE to %s', (_, head) => {
    const row = resolveOne(
      [verdictComment('security-reviewer', shas.approved, 'APPROVE')],
      shas[head],
    );

    expect(row).toEqual({
      reviewer: 'security-reviewer',
      state: 'STALE',
      sha: shas.approved,
      reason: 'files differ',
    });
    expect(reviewersNeedingReview([row])).toEqual(['security-reviewer']);
  });

  it('does not carry an APPROVE when the base branch changed a PR-touched file', () => {
    const verdicts = latestVerdicts(
      [verdictComment('security-reviewer', shas.approved, 'APPROVE')],
      TRUSTED,
    );

    const [row] = resolveReviewStatus(['security-reviewer'], verdicts, {
      headSha: shas.baseTouch,
      base: 'main-touches-pr',
      cwd: dir,
    });

    expect(row.state).toBe('STALE');
  });

  it('does not carry an APPROVE on an unknown commit, and says why', () => {
    const row = resolveOne(
      [verdictComment('security-reviewer', UNKNOWN_SHA, 'APPROVE')],
      shas.cleanMerge,
    );

    expect(row).toEqual({
      reviewer: 'security-reviewer',
      state: 'STALE',
      sha: UNKNOWN_SHA,
      reason: 'unresolved',
    });
  });

  it('does not carry when the latest verdict requests changes after an older APPROVE', () => {
    const comments = [
      verdictComment('security-reviewer', shas.approved, 'APPROVE'),
      verdictComment('security-reviewer', shas.approved, 'REQUEST_CHANGES'),
    ];

    const row = resolveOne(comments, shas.cleanMerge);

    expect(row.state).toBe('REQUEST_CHANGES');
    expect(reviewersNeedingReview([row])).toEqual(['security-reviewer']);
  });

  it('does not carry an APPROVE posted by an untrusted author', () => {
    const row = resolveOne(
      [byUntrustedAuthor(verdictComment('security-reviewer', shas.approved, 'APPROVE'))],
      shas.cleanMerge,
    );

    expect(row.state).toBe('MISSING');
  });

  it('keeps required reviewers in order and flags only those without a counting APPROVE', () => {
    const verdicts = latestVerdicts(
      [verdictComment('architecture-reviewer', shas.approved, 'APPROVE')],
      TRUSTED,
    );
    const required = ['architecture-reviewer', 'standards-reviewer'];

    const rows = resolveReviewStatus(required, verdicts, {
      headSha: shas.cleanMerge,
      base: 'main',
      cwd: dir,
    });

    expect(rows.map((row) => row.state)).toEqual(['CARRIED', 'MISSING']);
    expect(reviewersNeedingReview(rows)).toEqual(['standards-reviewer']);
  });
});

describe('formatStatus', () => {
  const sha = 'abc1234def5678abc1234def5678abc1234def56';

  it.each([
    [{ state: 'APPROVE', sha }, 'APPROVE'],
    [{ state: 'CARRIED', sha }, 'APPROVE (carried from abc1234)'],
    [{ state: 'STALE', sha, reason: 'files differ' }, 'STALE (APPROVE on abc1234, files differ)'],
    [{ state: 'STALE', sha, reason: 'unresolved' }, 'STALE (APPROVE on abc1234, unresolved)'],
    [{ state: 'REQUEST_CHANGES', sha }, 'REQUEST_CHANGES (on abc1234)'],
    [{ state: 'MISSING', sha: null }, 'MISSING'],
  ])('labels %o as %s', (fields, label) => {
    const line = formatStatus({ reviewer: 'security-reviewer', ...fields });

    expect(line).toBe(`  ${label.padEnd(42)} security-reviewer`);
  });
});
