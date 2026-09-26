# 08 · Git, branches, and pull requests

## Flow

```
Issue (with requirement IDs and acceptance examples)
  → owner agent creates branch  <owner>/<issue>-<slug>
  → small commits (Conventional Commits)
  → pnpm verify passes locally
  → PR opened with the template fully filled in
  → CI: quality, tests, build, ownership, PR title
  → AI review panel (4–6 reviewers) posts verdicts
  → AI review gate passes, all conversations resolved
  → squash merge to main (PR title becomes the commit)
```

`main` is protected by a GitHub ruleset: no direct pushes, no force pushes, PR required, every required check green, conversations resolved, linear history, squash merges only.

## Branches

`<owner>/<issue-number>-<short-kebab-description>`, for example `api-engineer/42-plan-revalidation`.

- `<owner>` is an agent name from `.github/ownership.json`. The ownership check fails the PR if any file is outside that owner's area.
- One branch per issue per owner. When a feature spans areas, the tech lead splits the issue into one sub-issue per owner, merged in dependency order: `domain → db → engine → api → web`, with `qa` in parallel.
- The `ownership-override` label is reserved for repo-wide mechanical changes (for example a rename that touches every package). It requires a linked ADR or tech-lead issue explaining why.

## Commits and PR titles

[Conventional Commits](https://www.conventionalcommits.org/) with a required scope from `commitlint.config.mjs`:

```
feat(engine): evaluate AND/OR prerequisite expressions
fix(api): return STALE_SOURCE when the audit snapshot is older than the record
test(tests): add AC05 competing requirement allocation
docs(docs): add ADR-0003 solver runtime
chore(ci): cache pnpm store
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`, `revert`. Subject in lower case, imperative, no period, header ≤ 72 characters. The PR title follows the same format because it becomes the squash commit.

## Pull request size

Aim for under 400 changed lines excluding lockfile and generated migrations. Larger PRs need a note in the description explaining why they can't be split.

## The review panel

Every PR is reviewed by specialist reviewer agents (definitions in `.claude/agents/`). Each one posts one comment with a machine-readable verdict marker.

| Reviewer                 | Runs when                                                                 | Focus                                                                                               |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| architecture-reviewer    | Always                                                                    | Layering, dependency direction, ownership, placement, file size, design fit with `docs/planning/07` |
| standards-reviewer       | Always                                                                    | `docs/standards` compliance: naming, comments, data objects, API conventions                        |
| correctness-reviewer     | Any code change                                                           | Logic errors, edge cases, error handling, test adequacy                                             |
| security-reviewer        | Any code change                                                           | Authorization, tenant isolation, secrets, PII in logs, input validation, read-only boundary         |
| academic-safety-reviewer | Changes to domain, contract, engine, db, api, worker, assistant, or tests | UNKNOWN/CONDITIONAL semantics, AI claim boundary, freshness, determinism                            |
| accessibility-reviewer   | Changes to `apps/web`                                                     | WCAG 2.2 AA, plan-vs-registration clarity                                                           |

Verdicts: `APPROVE` or `REQUEST_CHANGES`. Any BLOCKER or MAJOR finding means REQUEST_CHANGES. The **AI review gate** check passes only when every required reviewer has approved the PR's current head commit. A new push requires fresh reviews.

The reviewers run automatically in GitHub Actions (`.github/workflows/ai-review.yml`) and can also be run locally with `/review-pr <number>`.

## Responding to review

- The owning agent fixes findings in new commits on the same branch (no force-push once review has started).
- Disagreements are answered in the review comment thread with reasoning. The tech lead settles disputes.
- Deferring a MINOR finding requires an issue link.

## Definition of done

From `docs/planning/06`: implementation and review complete; tests pass; academic review done when meaning changes; accessibility and privacy impact considered; telemetry and rollback noted; user-facing wording reflects uncertainty; traceability (requirement IDs) updated in the PR.
