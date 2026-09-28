# ADR-0006: Review approvals carry across base merges

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product owner, tech lead
- **Related:** amends ADR-0002, standard 08 §The review panel, issues #129, #131, #137, PR #130

## Context

ADR-0002 decided that the **AI review gate** blocks merging until every required reviewer approves the PR's current head commit. The `main` ruleset also requires a branch to be up to date before it merges.

Together, these two rules make every merge expensive for the other open PRs. Each merge to `main` forces every open PR to update its branch, and the update is a new head commit. That commit has no approvals, so the full panel of up to five reviewers runs again, even when the PR's own change is unchanged.

GitHub's merge queue would solve this, but it isn't available on personal-account repositories. The options were:

1. **Carry an approval to a head whose PR change is identical.** The gate recognizes that updating from the base didn't change what was reviewed.
2. **Transfer the repository to an organization** to get a merge queue. That's an account and billing change outside this repo, and it moves settings, secrets and integrations.
3. **Drop the up-to-date requirement.** A PR could then merge on a stale base without its checks having run against current `main`.

The product owner chose option 1.

## Decision

Option 1. A required reviewer passes the gate when both of these hold:

- Their **latest trusted verdict** is `APPROVE`. A later `REQUEST_CHANGES` overrides an earlier approval, and markers from untrusted authors are ignored.
- That verdict is on the current head commit, or on an earlier commit X whose **PR files are identical** to the head H's. The PR files of a commit `sha` are compared in two parts, and both must match between X and H:
  1. **The touched-path set.** The paths the PR touches, each with its status letter, from `git diff --no-renames --name-status $(git merge-base origin/<base> <sha>) <sha>`. With `--no-renames`, a rename is a delete plus an add.
  2. **Each path's tree entry.** For every one of those paths, the `git ls-tree` entry at `sha`: mode, type and blob, or absent in both.

Every file outside the touched-path set comes from the base branch, which is already reviewed. Every file inside it is byte-identical to what the reviewers approved, including whitespace, mode and position. So a merge from `main` that leaves the PR's files alone carries approvals, and any edit, rename, mode change, moved block or whitespace change to a PR file does not. `scripts/lib/review-carryover.mjs` (`computeChangeFingerprint`) implements the rule.

### Why not `git patch-id`

The first version compared `git patch-id` values of the PR diff. Two review rounds on #130 rejected it:

- `--stable` drops whitespace before hashing, so `a = ' '` and `a = ''` hash the same, and so do two YAML files that differ only in a key's indentation. A behavior-changing whitespace edit could carry an approval.
- `--verbatim` fixes whitespace, but a patch-id still can't see renames, mode changes or moved hunks, so those edits could also carry.

A patch-id can't be made airtight, so the decision on #130 replaced it with file identity.

### Fail-closed cases

A fresh review is required when:

- the base branch changed a file the PR touches, even if the PR's own diff is unchanged;
- the approved commit or the head can't be resolved, for example after a force-push removed it, or the base ref is missing;
- the PR touches more than 500 paths;
- the PR change is empty;
- the reviewer's latest trusted verdict is anything other than `APPROVE`;
- the path set, a status letter, or any tree entry differs, including an edit hidden inside a merge commit.

Reviewer selection uses the same rule, so only reviewers without a current or carried approval run again.

Build, Tests, Quality, Ownership and PR title are unchanged: they still run on every push, including branch updates.

## Consequences

- Updating a branch from `main` no longer costs a full review round. ADR-0002's consequence "reviews cost model usage on every push" now applies to pushes that change the PR's own files.
- A false carry is limited to a head whose PR files are byte-identical to the ones a reviewer approved. The approval doesn't cover how that change interacts with new code on `main`; the non-review checks above still run on the updated head and catch build, test and quality breaks.
- Standard 08 §The review panel states the rule.
- **Verified live.** On 2026-09-28, PRs #136 and #142 were each updated from `main` after approval. Both carried every approval, and the review job was skipped.
- **Residual risk: the gate runs from the PR's branch.** The workflow runs under `pull_request`, so the gate and selection scripts come from the PR's own branch, and a PR could in principle change them to pass itself. Two controls mitigate this:
  - Only `devops-engineer` may edit `scripts/**` and `.github/**`. The ownership hook and the required CI Ownership check both enforce it.
  - Every change to those paths goes through the review panel, and the architecture and security reviewers always run.

  A possible follow-up is to run the gate logic from the base branch, so a PR can't change the rule that judges it. That's a devops-engineer change and needs its own issue.

## Revisit when

- GitHub merge queue becomes available for this repository, for example after a move to an organization.
- A carried approval is found to have let an unreviewed change merge.
- The gate logic moves to run from the base branch (the follow-up above).
