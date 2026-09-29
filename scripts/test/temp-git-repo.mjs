/**
 * @file Shared setup and cleanup for tests that build throwaway git repositories, so cleanup
 * can't race with git writing into `.git` in the background (#180).
 * @module scripts/test/temp-git-repo
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/**
 * Turns off git's automatic background work in a repository: `gc --auto` and `maintenance
 * --auto` run after commits and merges and can still be writing into `.git` when the test
 * removes the directory.
 *
 * @param {string} dir - Root of a freshly initialized repository.
 */
export function disableBackgroundGit(dir) {
  for (const [key, value] of [
    ['gc.auto', '0'],
    ['maintenance.auto', 'false'],
  ]) {
    execFileSync('git', ['config', key, value], { cwd: dir, stdio: 'ignore' });
  }
}

/**
 * Removes a temporary directory, retrying when a file appears or stays busy during the removal
 * (`ENOTEMPTY`, `EBUSY`, `EPERM`).
 *
 * @param {string} dir - Directory to remove; a missing directory is not an error.
 */
export function removeTempDir(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
