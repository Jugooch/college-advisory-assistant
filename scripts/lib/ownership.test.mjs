/**
 * @file Tests path resolution for the ownership check against a throwaway repository, one of
 * its registered worktrees, and look-alike directories that must stay outside the repository.
 * @see docs/team/README.md
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isOutsideRepo, loadOwnership, mayChange, toRepoPath } from './ownership.mjs';
import { commonGitDir, findCheckoutRoot } from './worktree-root.mjs';

let base = '';
let repo = '';
let worktree = '';

/**
 * Runs git in the temporary repository with a fixed, signing-free identity.
 *
 * @param {...string} args - Arguments for `git`.
 */
function git(...args) {
  const settings = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
  execFileSync('git', [...settings, '-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    stdio: 'ignore',
  });
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'caa-ownership-'));
  repo = join(base, 'repo with spaces');
  worktree = join(base, 'elsewhere', 'wt');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  writeFileSync(join(repo, 'scripts', 'a.mjs'), '');
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  git('worktree', 'add', '-q', '-b', 'feature', worktree);
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('toRepoPath', () => {
  it('resolves a path in the main checkout relative to its root', () => {
    expect(toRepoPath(join(repo, 'scripts', 'a.mjs'), repo)).toBe('scripts/a.mjs');
    expect(toRepoPath('scripts/new.mjs', repo)).toBe('scripts/new.mjs');
  });

  it('resolves a path in a registered worktree relative to the worktree root', () => {
    expect(toRepoPath(join(worktree, 'scripts', 'a.mjs'), repo)).toBe('scripts/a.mjs');
    expect(toRepoPath(join(worktree, 'apps', 'api', 'new.ts'), repo)).toBe('apps/api/new.ts');
  });

  it('applies the ownership map inside a worktree like in the main checkout', () => {
    const ownership = loadOwnership();
    const inArea = toRepoPath(join(worktree, 'scripts', 'a.mjs'), repo);
    const outOfArea = toRepoPath(join(worktree, 'apps', 'api', 'src', 'x.ts'), repo);

    expect(mayChange(ownership, 'devops-engineer', inArea)).toBe(true);
    expect(mayChange(ownership, 'devops-engineer', outOfArea)).toBe(false);
  });

  it('keeps a path in an unrelated directory outside the repository', () => {
    const other = join(base, 'unrelated');
    mkdirSync(other, { recursive: true });

    expect(isOutsideRepo(toRepoPath(join(other, 'scripts', 'x.mjs'), repo))).toBe(true);
  });

  it('keeps a path in an unrelated git repository outside the repository', () => {
    const other = join(base, 'other-repo');
    mkdirSync(other, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: other, stdio: 'ignore' });

    expect(isOutsideRepo(toRepoPath(join(other, 'scripts', 'x.mjs'), repo))).toBe(true);
  });

  it('rejects a hand-written .git file that names the repository git dir', () => {
    const fake = join(base, 'fake-main');
    mkdirSync(fake, { recursive: true });
    writeFileSync(join(fake, '.git'), `gitdir: ${join(repo, '.git')}\n`);

    expect(isOutsideRepo(toRepoPath(join(fake, 'scripts', 'x.mjs'), repo))).toBe(true);
  });

  it('rejects a .git file that borrows a registered worktree without its back link', () => {
    const fake = join(base, 'fake-worktree');
    mkdirSync(fake, { recursive: true });
    writeFileSync(join(fake, '.git'), `gitdir: ${join(repo, '.git', 'worktrees', 'wt')}\n`);

    expect(isOutsideRepo(toRepoPath(join(fake, 'scripts', 'x.mjs'), repo))).toBe(true);
  });

  it('fails closed when git metadata is unreadable', () => {
    const broken = join(base, 'broken');
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, '.git'), 'gitdir: /no/such/git/dir\n');

    expect(isOutsideRepo(toRepoPath(join(broken, 'x.mjs'), repo))).toBe(true);
  });

  it('resolves a symlink that points out of the repository to its outside target', () => {
    const outside = join(base, 'outside-target');
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(worktree, 'link'));

    expect(isOutsideRepo(toRepoPath(join(worktree, 'link', 'x.mjs'), repo))).toBe(true);
  });
});

describe('findCheckoutRoot', () => {
  it('returns null when the given repository root has no git metadata', () => {
    const plain = join(base, 'plain');
    mkdirSync(plain, { recursive: true });

    expect(findCheckoutRoot(join(worktree, 'x.mjs'), plain)).toBeNull();
  });

  it('finds the same common git dir from the main checkout and the worktree', () => {
    expect(commonGitDir(worktree)).toBe(commonGitDir(repo));
  });
});
