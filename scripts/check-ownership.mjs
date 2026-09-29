/**
 * @file Fails when a branch changes files outside its owner's area.
 *
 * The owner is the first segment of the branch name: `api-engineer/42-plan-requests`.
 * CI passes OWNERSHIP_OVERRIDE=true when the PR carries the `ownership-override` label, and the
 * PR description as PR_BODY. A labeled PR must say what authorizes the override (standard 08).
 * @module scripts/check-ownership
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { execFileSync } from 'node:child_process';

import { hasOverrideAuthorization } from './lib/override-authorization.mjs';
import { loadOwnership, mayChange, ownerOf } from './lib/ownership.mjs';

const ownership = loadOwnership();
const baseRef = process.env.BASE_REF ?? 'main';
const branch =
  process.env.HEAD_REF ??
  execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const owner = branch.split('/')[0] ?? '';

if (branch === 'main') {
  process.exit(0);
}

if (!(owner in ownership.owners)) {
  console.error(
    `Branch "${branch}" must start with an owner: ${Object.keys(ownership.owners).join(', ')}.`,
  );
  process.exit(1);
}

const isOverride = process.env.OWNERSHIP_OVERRIDE === 'true';
if (isOverride && !hasOverrideAuthorization(process.env.PR_BODY)) {
  console.error(
    'The ownership-override label needs its authorization in the PR body, for example ' +
      '"authorized by #108" or "authorized by ADR-0004" (standard 08, Ownership overrides).',
  );
  process.exit(1);
}

const diff = execFileSync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
  encoding: 'utf8',
});
const outside = diff
  .split('\n')
  .filter(Boolean)
  .filter((path) => !mayChange(ownership, owner, path));

if (outside.length === 0) {
  console.log(`Ownership check passed: every change is inside ${owner}'s area.`);
  process.exit(0);
}

const report = outside
  .map((path) => `  ${path}  (owner: ${ownerOf(ownership, path) ?? 'unowned'})`)
  .join('\n');
if (isOverride) {
  console.warn(`Ownership override label present. Files outside ${owner}'s area:\n${report}`);
  process.exit(0);
}
console.error(
  `${owner} changed files it does not own. Split these into a PR from the owning agent:\n${report}`,
);
process.exit(1);
