/**
 * @file Loads the ownership map and answers "may this owner change this path?".
 * @module scripts/lib/ownership
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findCheckoutRoot } from './worktree-root.mjs';

/** Absolute path of the repository root. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Reads .github/ownership.json.
 *
 * @returns {{ sharedPaths: string[], owners: Record<string, string[]>, reviewers: string[] }} The ownership map.
 */
export function loadOwnership() {
  return JSON.parse(readFileSync(join(REPO_ROOT, '.github', 'ownership.json'), 'utf8'));
}

/**
 * Converts a glob with `*` and `**` into an anchored regular expression.
 *
 * @param {string} glob - Pattern relative to the repository root.
 * @returns {RegExp} Matcher for repository-relative POSIX paths.
 */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped
    .replace(/\*\*\/?/g, '@@GLOBSTAR@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@GLOBSTAR@@/g, '.*');
  return new RegExp(`^${pattern}$`);
}

/**
 * Resolves a path (including `..` segments and symlinks) to a repository-relative POSIX path.
 * A path inside a registered `git worktree` of the repository is relative to that worktree's
 * root, so the ownership map applies there as in the main checkout.
 *
 * @param {string} filePath - Path to normalize; a relative path is resolved against `repoRoot`.
 * @param {string} [repoRoot] - Root of a checkout of the repository; defaults to this one.
 * @returns {string} Repository-relative path using forward slashes. A path in no checkout of
 *   the repository starts with `../` or is absolute (see {@link isOutsideRepo}).
 */
export function toRepoPath(filePath, repoRoot = REPO_ROOT) {
  const target = resolveRealPath(resolve(repoRoot, filePath));
  // SECURITY: fail closed; unreadable git metadata falls back to the given root, where a path
  // in another directory stays outside the repository.
  const checkoutRoot = findCheckoutRoot(target, repoRoot) ?? realpathSync(repoRoot);
  return relative(checkoutRoot, target).split('\\').join('/');
}

/**
 * Resolves symlinks in the deepest existing ancestor of a path, so a link can't hide an outside target.
 *
 * @param {string} absolutePath - Absolute path that may not exist yet.
 * @returns {string} The path with every existing symlink resolved.
 */
function resolveRealPath(absolutePath) {
  if (existsSync(absolutePath)) {
    return realpathSync(absolutePath);
  }
  const parent = dirname(absolutePath);
  return parent === absolutePath
    ? absolutePath
    : join(resolveRealPath(parent), basename(absolutePath));
}

/**
 * Checks whether a repository-relative path escapes the repository root.
 *
 * @param {string} repoPath - Result of {@link toRepoPath}.
 * @returns {boolean} True when the path points outside the repository.
 */
export function isOutsideRepo(repoPath) {
  return repoPath === '..' || repoPath.startsWith('../') || isAbsolute(repoPath);
}

/**
 * Decides whether an owner may change a path.
 *
 * @param {ReturnType<typeof loadOwnership>} ownership - The ownership map.
 * @param {string} owner - Agent name, for example `api-engineer`.
 * @param {string} repoPath - Repository-relative path.
 * @returns {boolean} True when the path is shared or inside the owner's area.
 */
export function mayChange(ownership, owner, repoPath) {
  const globs = [...ownership.sharedPaths, ...(ownership.owners[owner] ?? [])];
  return globs.some((glob) => globToRegExp(glob).test(repoPath));
}

/**
 * Finds which owner a path belongs to.
 *
 * @param {ReturnType<typeof loadOwnership>} ownership - The ownership map.
 * @param {string} repoPath - Repository-relative path.
 * @returns {string | null} The owning agent, or null when the path is unowned.
 */
export function ownerOf(ownership, repoPath) {
  const match = Object.entries(ownership.owners).find(([, globs]) =>
    globs.some((glob) => globToRegExp(glob).test(repoPath)),
  );
  return match ? match[0] : null;
}
