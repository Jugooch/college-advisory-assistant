---
name: open-pr
description: Verify, commit, push, and open a pull request that follows the repo's branch, commit, and PR template rules. Use when a builder agent has finished a change and is ready for review.
argument-hint: '[issue-number]'
allowed-tools:
  - Bash(pnpm verify)
  - Bash(pnpm check:*)
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(git branch:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
---

# Open a pull request

Follow every step. Stop and report if any step fails; don't skip ahead.

1. **Check the branch.** `git branch --show-current` must match `<owner>/<issue>-<slug>`, where `<owner>` is your agent name. If you're on `main`, stop.
2. **Check ownership.** `pnpm check:ownership`. If it fails, move the out-of-area change into a handoff request instead of committing it.
3. **Verify.** `pnpm verify`. Every step must pass. Fix the code; never disable rules or lower thresholds.
4. **Commit.** Stage only intended files (`git add <paths>`; never `git add -A` without reviewing `git status`). Use a Conventional Commit with an allowed scope, for example `feat(engine): evaluate and/or prerequisite expressions`.
5. **Push.** `git push -u origin HEAD`.
6. **Create the PR.** The title is a Conventional Commit (it becomes the squash commit). Fill in every section of `.github/pull_request_template.md`:

```bash
gh pr create --base main --title "<type>(<scope>): <subject>" --body-file - <<'BODY'
## Summary
<what changed and why, 1-3 sentences>

## Owner
<agent name> · closes #<issue>

## Requirements
<FR-xx / NFR-xx / ACxx covered, or "none (tooling/docs)">

## Changes
- <file or area>: <change>

## Tests
- <test file>: <behavior proven>
- `pnpm verify`: passed

## Academic safety and security impact
<none, or what changed and how it's protected>

## Risk and rollback
<risk level; how to roll back>

## Handoffs
<none, or blocked-by / follow-up issues for other owners>
BODY
```

Pass the body on stdin with a heredoc as shown. Command substitution (`$(...)`) is blocked for team agents.

7. **Report** the PR URL. CI and the AI review panel start automatically.
