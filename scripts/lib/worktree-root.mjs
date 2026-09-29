/**
 * @file Finds which checkout of this repository contains a path: the main checkout or one of
 * its registered `git worktree`s, wherever the worktree lives on disk.
 * @module scripts/lib/worktree-root
 * @see docs/team/README.md
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Reads the path stored in a git metadata file (`.git`, `gitdir`, `commondir`).
 *
 * @param {string} filePath - Metadata file to read.
 * @param {string} baseDir - Directory a relative stored path is resolved against.
 * @returns {string} The absolute path the file names.
 */
function readGitPointer(filePath, baseDir) {
  const firstLine = readFileSync(filePath, 'utf8').split('\n')[0] ?? '';
  return resolve(baseDir, firstLine.replace(/^gitdir:\s*/, '').trim());
}

/**
 * Finds the common git directory (the one holding objects, refs and `worktrees/`) of a checkout.
 *
 * @param {string} checkoutRoot - Directory that contains a `.git` file or directory.
 * @returns {string | null} Real path of the common git directory, or null when there is none.
 */
export function commonGitDir(checkoutRoot) {
  const dotGit = join(checkoutRoot, '.git');
  if (!existsSync(dotGit)) {
    return null;
  }
  if (statSync(dotGit).isDirectory()) {
    return realpathSync(dotGit);
  }
  const gitDir = readGitPointer(dotGit, checkoutRoot);
  const commonDirFile = join(gitDir, 'commondir');
  return realpathSync(existsSync(commonDirFile) ? readGitPointer(commonDirFile, gitDir) : gitDir);
}

/**
 * Checks whether a directory is a checkout of the repository with the given common git dir.
 * A linked worktree counts only when git registered it: its `.git` file names a folder in
 * `<common>/worktrees/`, and that folder's `gitdir` file points back at this `.git` file. A
 * hand-written `.git` file that merely names this repository's git dir does not count.
 *
 * @param {string} dir - Real path of a candidate checkout root.
 * @param {string} repoGitDir - Real path of this repository's common git directory.
 * @returns {boolean} True for the main checkout or a registered worktree of it.
 */
function isCheckoutOf(dir, repoGitDir) {
  const dotGit = join(dir, '.git');
  if (!existsSync(dotGit)) {
    return false;
  }
  if (statSync(dotGit).isDirectory()) {
    return realpathSync(dotGit) === repoGitDir;
  }
  const gitDir = realpathSync(readGitPointer(dotGit, dir));
  if (dirname(gitDir) !== join(repoGitDir, 'worktrees')) {
    return false;
  }
  const backLink = readGitPointer(join(gitDir, 'gitdir'), gitDir);
  return existsSync(backLink) && realpathSync(backLink) === realpathSync(dotGit);
}

/**
 * Finds the nearest checkout of the repository that contains a path.
 *
 * @param {string} realPath - Absolute path with its existing symlinks already resolved.
 * @param {string} repoRoot - Root of any checkout of the repository.
 * @returns {string | null} Real path of the containing checkout, or null when the path is in
 *   none. An error reading git metadata also gives null, so callers treat the path as outside
 *   the repository and fail closed.
 */
export function findCheckoutRoot(realPath, repoRoot) {
  try {
    const repoGitDir = commonGitDir(realpathSync(repoRoot));
    if (repoGitDir === null) {
      return null;
    }
    for (let dir = realPath; ; dir = dirname(dir)) {
      if (isCheckoutOf(dir, repoGitDir)) {
        return dir;
      }
      if (dirname(dir) === dir) {
        return null;
      }
    }
  } catch {
    return null;
  }
}
