---
name: review-pr
description: Run the AI reviewer panel on a pull request locally and post each verdict to the PR so the AI review gate can read it. Use when asked to review a PR, or to re-run reviews after new commits.
argument-hint: '<pr-number>'
disable-model-invocation: true
allowed-tools:
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr comment:*)
  - Bash(git fetch:*)
  - Bash(node scripts/select-reviewers.mjs:*)
---

# Review a pull request with the reviewer panel

PR number: `$ARGUMENTS`

1. **Load the PR.** `gh pr view $ARGUMENTS --json number,title,headRefName,headRefOid,baseRefName,files`. Note the head SHA.
2. **Pick reviewers.** Required reviewers depend on the changed files (see `scripts/lib/review-selection.mjs`):
   - Always: `architecture-reviewer`, `standards-reviewer`.
   - Any non-Markdown change: add `correctness-reviewer`, `security-reviewer`.
   - Any change in domain, api-contract, engine, db, assistant, test-kit, api, worker, or tests: add `academic-safety-reviewer`.
   - Any change in `apps/web`: add `accessibility-reviewer`.
3. **Run them in parallel.** Launch every required reviewer agent in a single message. Give each one the PR number, head SHA, and base branch, and tell it to return its review in its standard output format without posting.
4. **Check the output.** Each review must start with the exact marker line `<!-- ai-review reviewer:<name> sha:<head sha> verdict:<APPROVE|REQUEST_CHANGES> -->`. If a reviewer's output is malformed, re-run that reviewer; don't edit its verdict.
5. **Post each review** as its own PR comment, unchanged:
   `gh pr comment $ARGUMENTS --body-file <file>` (write the body to a file in your scratchpad first).
6. **Summarize** for the user: a table of reviewer → verdict → count of BLOCKER/MAJOR/MINOR findings, and the list of required changes, grouped by the owner agent who should fix them.

Never change reviewer verdicts, never post approvals you didn't get from a reviewer agent, and never merge.
