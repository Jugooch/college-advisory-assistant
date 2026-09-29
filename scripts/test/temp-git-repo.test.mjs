/**
 * @file Tests the throwaway-repository helpers: background git is off, and cleanup removes a
 * populated repository and tolerates one that is already gone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { disableBackgroundGit, removeTempDir } from './temp-git-repo.mjs';

/**
 * Creates an initialized repository with one commit in a new temporary directory.
 *
 * @returns {string} The repository root.
 */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'caa-temp-git-repo-'));
  const run = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  run('init', '-q', '-b', 'main');
  disableBackgroundGit(dir);
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  run('add', '.');
  run('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'init');
  return dir;
}

describe('disableBackgroundGit', () => {
  it('turns off automatic gc and maintenance in the repository', () => {
    const dir = makeRepo();
    const get = (/** @type {string} */ key) =>
      execFileSync('git', ['config', '--local', '--get', key], { cwd: dir, encoding: 'utf8' });

    expect(get('gc.auto').trim()).toBe('0');
    expect(get('maintenance.auto').trim()).toBe('false');
    removeTempDir(dir);
  });
});

describe('removeTempDir', () => {
  it('removes a repository with its .git directory', () => {
    const dir = makeRepo();

    removeTempDir(dir);

    expect(existsSync(dir)).toBe(false);
  });

  it('ignores a directory that is already gone', () => {
    const dir = makeRepo();
    removeTempDir(dir);

    expect(() => {
      removeTempDir(dir);
    }).not.toThrow();
  });
});
