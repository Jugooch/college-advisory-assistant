# ADR-0006: Review approvals carry across base merges

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product owner, tech lead
- **Related:** amends ADR-0002, standard 08 §The review panel, issues #129, #131, PR #130

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
- That verdict is on the current head commit, or on an earlier commit X whose **PR change is byte-identical** to the head's. The PR change of a commit `sha` is `git diff $(git merge-base origin/<base> <sha>) <sha>`. Two changes are identical when their `git patch-id --verbatim` values are equal.

`--verbatim` is required, not `--stable` on its own. Without `--verbatim`, `git patch-id` drops whitespace before hashing, so `a = ' '` and `a = ''` hash the same, and so do two YAML files whose only difference is a key's indentation level. The #130 reviewers showed that a whitespace-only edit like that could change behavior and still carry an approval. `--verbatim` keeps whitespace and still ignores line numbers, so a clean merge from `main` that only shifts lines still carries.

The rule fails closed. A fresh review is required when:

- the approved commit can't be resolved, for example after a force-push removed it;
- either patch-id can't be computed, or the change is empty;
- the base ref is missing;
- the two patch-ids differ in any way, including an edit hidden inside a merge commit.

Reviewer selection uses the same rule, so only reviewers without a current or carried approval run again.

Build, Tests, Quality, Ownership and PR title are unchanged: they still run on every push, including branch updates.

## Consequences

- Updating a branch from `main` no longer costs a full review round. ADR-0002's consequence "reviews cost model usage on every push" now applies to pushes that change the PR's own diff.
- A false carry is limited to a head whose PR change is byte-identical to one a reviewer approved. The approval doesn't cover how that change interacts with new code on `main`; the non-review checks above still run on the updated head and catch build, test and quality breaks.
- Standard 08 §The review panel states the rule.
- **Residual risk: the gate runs from the PR's branch.** The workflow runs under `pull_request`, so the gate and selection scripts come from the PR's own branch, and a PR could in principle change them to pass itself. Two controls mitigate this:
  - Only `devops-engineer` may edit `scripts/**` and `.github/**`. The ownership hook and the required CI Ownership check both enforce it.
  - Every change to those paths goes through the review panel, and the architecture and security reviewers always run.

  A possible follow-up is to run the gate logic from the base branch, so a PR can't change the rule that judges it. That's a devops-engineer change and needs its own issue.

## Revisit when

- GitHub merge queue becomes available for this repository, for example after a move to an organization.
- A carried approval is found to have let an unreviewed change merge.
- The gate logic moves to run from the base branch (the follow-up above).
