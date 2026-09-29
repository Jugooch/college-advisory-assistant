/**
 * @file Builds a throwaway git repository with one approved PR commit and one head per
 * carry-over scenario, for the review carry-over tests.
 * @module scripts/test/review-scenario-repo
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MAX_CARRY_PATHS } from '../lib/review-carryover.mjs';
import { disableBackgroundGit } from './temp-git-repo.mjs';

/** A well-formed sha that no scenario repository contains. */
export const UNKNOWN_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
const EDITED = LINES.map((line, index) => (index === 9 ? 'line 10 changed by the PR' : line));
const BUILD_BLOCK = 'build:\n  permissions: read-all\n';
const DEPLOY_BLOCK = 'deploy:\n  permissions: write-all\n';

let dir = '';

/**
 * Builds the PR's workflow file; indenting `permissions` under `env` changes its meaning.
 *
 * @param {string} indent - Leading spaces before `permissions:`.
 * @returns {string} YAML text.
 */
function workflow(indent) {
  return `jobs:\n  build:\n    env:\n      DEBUG: 'false'\n${indent}permissions: read-all\n`;
}

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
 * Commits whatever is staged and returns the new sha.
 *
 * @param {string} message - Commit message.
 * @returns {string} The new commit's sha.
 */
function commitIndex(message) {
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

/**
 * Writes files, stages everything and commits.
 *
 * @param {Record<string, string>} files - Paths and contents.
 * @param {string} message - Commit message.
 * @returns {string} The new commit's sha.
 */
function commit(files, message) {
  Object.entries(files).forEach(([path, text]) => writeFileSync(join(dir, path), text));
  git('add', '.');
  return commitIndex(message);
}

/**
 * Builds the base, the approved PR commit, the base moving on (an unrelated file), and the
 * clean merge of that base into the PR.
 *
 * @returns {Record<string, string>} Shas for `approved`, `base`, `cleanMerge`, `evilMerge`.
 */
function buildApprovedPr() {
  git('init', '-q', '-b', 'main');
  disableBackgroundGit(dir);
  commit({ 'a.txt': `${LINES.join('\n')}\n`, 'b.txt': 'base\n' }, 'base');
  git('switch', '-q', '-c', 'feature');
  const approved = commit(
    {
      'a.txt': `${EDITED.join('\n')}\n`,
      'sep.mjs': "export const SEP = ' ';\n",
      'ci.yml': workflow('    '),
      'blocks.yml': `${BUILD_BLOCK}${DEPLOY_BLOCK}`,
      'tool.sh': 'echo tool\n',
    },
    'pr change',
  );
  git('switch', '-q', 'main');
  const base = commit({ 'b.txt': 'main moved\n' }, 'main moves an unrelated file');
  git('switch', '-q', 'feature');
  git('merge', '-q', '--no-edit', 'main');
  const cleanMerge = git('rev-parse', 'HEAD');
  git('switch', '-q', '-c', 'evil', approved);
  git('merge', '-q', '--no-commit', 'main');
  const evilMerge = commit({ 'c.txt': 'sneaked in\n' }, 'merge main');
  return { approved, base, cleanMerge, evilMerge };
}

/**
 * Builds one head per change made after approval, each branched from the clean merge.
 *
 * @param {string} cleanMerge - The clean merge commit.
 * @returns {Record<string, string>} Shas by scenario name.
 */
function buildChangedHeads(cleanMerge) {
  const from = (name) => git('switch', '-q', '-c', name, cleanMerge);
  const heads = {};
  from('edited');
  heads.edited = commit({ 'a.txt': `${EDITED.join('\n')}\nline 21 by the PR\n` }, 'edit');
  from('string-whitespace');
  heads.stringWhitespace = commit({ 'sep.mjs': "export const SEP = '';\n" }, 'drop the space');
  from('yaml-indent');
  heads.yamlIndent = commit({ 'ci.yml': workflow('      ') }, 'indent permissions');
  from('moved-block');
  heads.movedBlock = commit({ 'blocks.yml': `${DEPLOY_BLOCK}${BUILD_BLOCK}` }, 'move a block');
  from('renamed');
  git('mv', 'sep.mjs', 'separator.mjs');
  heads.renamed = commitIndex('rename only');
  from('mode-only');
  chmodSync(join(dir, 'tool.sh'), 0o755);
  git('update-index', '--chmod=+x', 'tool.sh');
  heads.modeOnly = commitIndex('chmod +x only');
  return heads;
}

/**
 * Builds heads whose base branch moved: `baseTouch` merges a `main-touches-pr` commit that
 * edits a PR-touched file, and `huge` touches more paths than the carry-over cap.
 *
 * @param {{ base: string, cleanMerge: string }} shas - Base and clean merge commits.
 * @returns {Record<string, string>} Shas for `baseTouch` and `huge`.
 */
function buildBaseHeads(shas) {
  git('switch', '-q', '-c', 'main-touches-pr', shas.base);
  commit({ 'a.txt': `header from main\n${LINES.join('\n')}\n` }, 'main edits a.txt');
  git('switch', '-q', '-c', 'base-touch', shas.cleanMerge);
  git('merge', '-q', '--no-edit', 'main-touches-pr');
  const baseTouch = git('rev-parse', 'HEAD');
  git('switch', '-q', '-c', 'huge', shas.base);
  mkdirSync(join(dir, 'many'));
  const many = Array.from({ length: MAX_CARRY_PATHS + 1 }, (_, index) => [
    `many/${index}.txt`,
    `${index}\n`,
  ]);
  const huge = commit(Object.fromEntries(many), 'touch too many paths');
  return { baseTouch, huge };
}

/**
 * Creates the scenario repository in a new temporary directory.
 *
 * @returns {{ dir: string, shas: Record<string, string> }} The directory (the caller removes
 *   it) and the scenario commits by name.
 */
export function buildScenarioRepo() {
  dir = mkdtempSync(join(tmpdir(), 'caa-review-carryover-'));
  const shas = buildApprovedPr();
  Object.assign(shas, buildChangedHeads(shas.cleanMerge), buildBaseHeads(shas));
  return { dir, shas };
}
