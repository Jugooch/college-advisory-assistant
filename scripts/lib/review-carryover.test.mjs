/**
 * @file Tests for carrying AI review approvals across commits with the same PR change, using a
 * throwaway git repository built in a temporary directory.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  computePatchId,
  latestVerdicts,
  resolveReviewStatus,
  reviewersNeedingReview,
  trustedAuthors,
} from './review-carryover.mjs';

const TRUSTED = new Set(['github-actions[bot]', 'owner']);
const UNKNOWN_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
/**
 * Builds the PR's workflow file; indenting `permissions` under `env` changes its meaning.
 *
 * @param {string} indent - Leading spaces before `permissions:`.
 * @returns {string} YAML text.
 */
function workflow(indent) {
  return `jobs:\n  build:\n    env:\n      DEBUG: 'false'\n${indent}permissions: read-all\n`;
}

let dir = '';
/** Commits in the scenario repository, by role. */
const shas = {};

/**
 * Runs git in the scenario repository with a fixed, signing-free identity.
 *
 * @param {...string} args - Arguments for `git`.
 * @returns {string} Trimmed output.
 */
function git(...args) {
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
  const settings = ['-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false'];
  return execFileSync('git', [...identity, ...settings, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Writes files and commits them.
 *
 * @param {Record<string, string>} files - Paths and contents.
 * @param {string} message - Commit message.
 * @returns {string} The new commit's sha.
 */
function commit(files, message) {
  Object.entries(files).forEach(([path, text]) => writeFileSync(join(dir, path), text));
  git('add', '.');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

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
  dir = mkdtempSync(join(tmpdir(), 'caa-review-carryover-'));
  git('init', '-q', '-b', 'main');
  commit({ 'a.txt': `${LINES.join('\n')}\n`, 'b.txt': 'base\n' }, 'base');

  git('switch', '-q', '-c', 'feature');
  const edited = LINES.map((line, index) => (index === 9 ? 'line 10 changed by the PR' : line));
  shas.approved = commit(
    {
      'a.txt': `${edited.join('\n')}\n`,
      'sep.mjs': "export const SEP = ' ';\n",
      'ci.yml': workflow('    '),
    },
    'pr change',
  );

  git('switch', '-q', 'main');
  // NOTE: prepending shifts the PR hunk's line numbers without touching its context.
  commit({ 'a.txt': `header\n${LINES.join('\n')}\n`, 'b.txt': 'main moved\n' }, 'main moves');
  shas.base = git('rev-parse', 'HEAD');

  git('switch', '-q', 'feature');
  git('merge', '-q', '--no-edit', 'main');
  shas.cleanMerge = git('rev-parse', 'HEAD');

  git('switch', '-q', '-c', 'evil', shas.approved);
  git('merge', '-q', '--no-commit', 'main');
  shas.evilMerge = commit({ 'c.txt': 'sneaked in\n' }, 'merge main');

  git('switch', '-q', '-c', 'edited', shas.cleanMerge);
  shas.edited = commit({ 'a.txt': `header\n${edited.join('\n')}\nline 21 by the PR\n` }, 'edit');

  git('switch', '-q', '-c', 'string-whitespace', shas.cleanMerge);
  shas.stringWhitespace = commit({ 'sep.mjs': "export const SEP = '';\n" }, 'drop the space');

  git('switch', '-q', '-c', 'yaml-indent', shas.cleanMerge);
  shas.yamlIndent = commit({ 'ci.yml': workflow('      ') }, 'indent permissions');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('computePatchId', () => {
  it('matches after merging an updated base without other changes', () => {
    const approved = computePatchId(shas.approved, 'main', dir);

    expect(approved).toMatch(/^[0-9a-f]{40}$/);
    expect(computePatchId(shas.cleanMerge, 'main', dir)).toBe(approved);
  });

  it('accepts an abbreviated sha', () => {
    const full = computePatchId(shas.approved, 'main', dir);

    expect(computePatchId(shas.approved.slice(0, 7), 'main', dir)).toBe(full);
  });

  it('differs when a merge commit sneaks in an extra change', () => {
    const approved = computePatchId(shas.approved, 'main', dir);

    expect(computePatchId(shas.evilMerge, 'main', dir)).not.toBe(approved);
  });

  it('differs when the PR edits its own files', () => {
    const approved = computePatchId(shas.approved, 'main', dir);

    expect(computePatchId(shas.edited, 'main', dir)).not.toBe(approved);
  });

  it.each([
    ['inside a string literal', 'stringWhitespace'],
    ['in YAML indentation', 'yamlIndent'],
  ])('differs when the PR changes only whitespace %s', (_, head) => {
    const approved = computePatchId(shas.approved, 'main', dir);

    expect(computePatchId(shas[head], 'main', dir)).not.toBe(approved);
  });

  it('returns null for a commit that is not in the repository', () => {
    expect(computePatchId(UNKNOWN_SHA, 'main', dir)).toBeNull();
  });

  it('returns null for a value that is not a hex sha', () => {
    expect(computePatchId('--output=/tmp/x', 'main', dir)).toBeNull();
  });

  it('returns null when the commit has no change against the base', () => {
    expect(computePatchId(shas.base, 'main', dir)).toBeNull();
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
  ])('does not carry an APPROVE to %s', (_, head) => {
    const row = resolveOne(
      [verdictComment('security-reviewer', shas.approved, 'APPROVE')],
      shas[head],
    );

    expect(row.state).toBe('STALE');
    expect(reviewersNeedingReview([row])).toEqual(['security-reviewer']);
  });

  it('does not carry an APPROVE on an unknown commit', () => {
    const row = resolveOne(
      [verdictComment('security-reviewer', UNKNOWN_SHA, 'APPROVE')],
      shas.cleanMerge,
    );

    expect(row.state).toBe('STALE');
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
