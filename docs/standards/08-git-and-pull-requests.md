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
- The `ownership-override` label is allowed only in the cases listed under [Ownership overrides](#ownership-overrides).

## Ownership overrides

A PR may change files outside its owner's area only with the `ownership-override` label, and only in one of these cases. Every override PR links its authorizing ADR or tech-lead issue in the body. Reviewers treat any out-of-area file that doesn't fit a listed case as a BLOCKER.

| Case                  | What it allows                                                                                                                              | Authorized by                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Repo-wide mechanical  | A mechanical change that touches many areas, for example a rename across every package                                                      | Its own ADR or tech-lead issue            |
| Known finding fixed   | Removing a fixed entry from `tests/support/known-findings.ts` in the fixing PR (standard 07, known findings)                                | Standard 07 and the finding's `bug` issue |
| Required-field ripple | Updating a test-kit builder when a domain PR adds a required field, under the rules below                                                   | #108 (ADR-0004)                           |
| Seed-mirror ripple    | Updating the api's copy of the dev seed when a data PR changes seeded academic records, under the rules below                               | #252 (ADR-0004 Amendment 1)               |
| Wording-map ripple    | Adding frontend-authored wording to the web reason-code map when a domain PR adds, renames or removes a `ReasonCode`, under the rules below | #261 (ADR-0004 Amendment 2)               |

### Required-field ripple

When a domain PR adds a required field to a model, the test-kit builder for that model stops compiling. Neither order of two separate PRs keeps `main` green: the builder can't set a field the schema doesn't have yet (excess-property error), and the schema can't require a field the builder doesn't set. So the builder fix lands in the domain PR, under these rules:

1. **Only the orchestrator** (the main session) makes the edit. Builder agents never do; their edit hook blocks it.
2. **Only these files:**
   - `packages/test-kit/src/builders/<model>.builder.ts`: the new field in the defaults, plus a TSDoc line naming the default.
   - `packages/test-kit/src/builders/<model>.builder.test.ts`: the field in the literal expectations.
   - When the field is a non-nullable ID: a new kind in `packages/test-kit/src/fixtures/synthetic-id.ts`, with a literal test in `synthetic-id.test.ts`.
3. **Conservative default.** A nullable field defaults to `null`, meaning unknown. A non-nullable field defaults to a synthetic value that fits the builder's other defaults (for an ID, its `syntheticId` kind at seed 1). No new builder options, no other behavior changes.
4. **Its own commit** on the domain branch, for example `test(test-kit): default term credit bounds to null in the policy builder` (commit subjects are lower case).
5. **The PR body says so.** Under Handoffs, add:
   > **Ownership override (required-field ripple, standard 08, authorized by #108):** the orchestrator changed only `<files>`. Default: `<field>: <value>`. qa-engineer owns the default from here.

After the merge, qa-engineer may change the default in its own PR like any other test-kit code.

If anything else breaks (a golden case, an acceptance test, engine or db code), or no default fits rule 3, this case doesn't apply. Use a staged rollout instead, with each step its own single-owner PR:

1. The domain PR adds the field as `.optional()` with a `TODO(#issue)` to make it required. Until then, an omitted value means unknown. This is a temporary, tracked exception to standard 04 rule 10.
2. Each affected owner sets the field in its own code.
3. A final domain PR removes `.optional()`.

### Seed-mirror ripple

`apps/api/src/testing/seed-scenario-fixtures.ts` is a hand copy of the dev seed's academic records, because api test support can't import `@caa/db/testing` yet. `seed-scenario-fixtures.test.ts` deep-compares the copy with the seed plan, so a data PR that changes a seeded academic record breaks the api test. That covers a catalog course, rule, policy, term, attempt, snapshot or audit. Neither order of two separate PRs keeps `main` green. So the mirror fix lands in the data PR, under these rules:

1. **Only the orchestrator** (the main session) makes the edit. Builder agents never do; their edit hook blocks it.
2. **Only when the seed changed.** The data PR changes the seed plan under `packages/db/src/seed/`, and the mirror test fails without the edit.
3. **Only these files:**
   - `apps/api/src/testing/seed-scenario-fixtures.ts`: the mirrored records' values, copied literally from the seed. A private helper in the file may gain a parameter when a value can't be passed through it otherwise. No new exports, no other behavior changes.
   - When the mirror sets a field the test-kit builder doesn't default yet: that builder and its test, under the required-field ripple rules 2 and 3 above (a nullable field defaults to `null`).
4. **Its own commit** on the data branch, for example `test(api): mirror the seeded lab credit inclusion`.
5. **The PR body says so.** Under Handoffs, add:
   > **Ownership override (seed-mirror ripple, standard 08, authorized by #252):** the orchestrator changed only `<files>`. Mirrored change: `<record>.<field>: <value>`. api-engineer owns the mirror from here.

If anything else breaks, this case doesn't apply. Examples are an api test that asserts on the changed value, or seeded data the mirror doesn't hold yet, such as sections. The affected owner changes its code first in its own PR where it can; otherwise the tech lead rules on the issue. This case is retired when the api fixtures are built from the seed plan instead of copied (#253, #254, #255).

### Wording-map ripple

`apps/web/src/shared/utils/reason-code-wording.ts` is typed `Record<ReasonCode, ReasonWording>`, and its test fails when a code has no entry or an entry has no code. So a domain PR that adds, renames or removes a `ReasonCode` value breaks the web build. Neither order of two separate PRs keeps `main` green. The wording is student-facing and belongs to the frontend-engineer, so it lands in the domain PR under these rules:

1. **The frontend-engineer writes the wording.** Before the edit, the frontend-engineer posts the exact `explanation` and `nextStep` for each added or renamed code as a comment on the domain PR or its issue. The wording follows planning/10 and planning/11:
   - an UNKNOWN code says the result needs verification and names a human route;
   - no code is worded as passing, approved, eligible or registered;
   - a FAIL code says what is violated and the next step.
2. **Only the orchestrator** (the main session) applies it, copied character for character from that comment. The orchestrator never writes or edits wording. If the text needs a change, the frontend-engineer posts a new comment.
3. **Only these files:**
   - `apps/web/src/shared/utils/reason-code-wording.ts`: add entries for added codes, remove entries for removed codes, and move entries for renamed codes. No other entry changes, and no new helpers or exports.
   - `apps/web/src/shared/utils/reason-code-wording.test.ts`: literal expectations for the added codes, and only when the frontend-engineer's comment includes them.
4. **Its own commit** on the domain branch, for example `feat(web): word the scheduling reason codes`.
5. **The PR body says so.** Under Handoffs, add:
   > **Ownership override (wording-map ripple, standard 08, authorized by #261):** the orchestrator applied the frontend-engineer's wording from `<comment link>` literally, changing only `<files>`. Codes: `<codes>`. frontend-engineer owns the wording from here.

Reviewers compare the applied text with the linked comment. Any difference, or wording without a linked comment, is a BLOCKER. After the merge, the frontend-engineer may change the wording in its own PR.

If anything else in `apps/web` breaks, this case doesn't apply. An example is a component that switches on the code. The frontend-engineer changes that code first in its own PR where it can; otherwise the tech lead rules on the issue.

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

Verdicts: `APPROVE` or `REQUEST_CHANGES`. Any BLOCKER or MAJOR finding means REQUEST_CHANGES. The **AI review gate** check passes only when every required reviewer's latest verdict is `APPROVE`, either on the PR's current head commit or on an earlier commit whose PR files are identical: the same touched paths and status letters (`git diff --no-renames --name-status` from its merge-base with the base branch), and the same `git ls-tree` entry (mode, type and blob, or absent) for each of those paths. Updating a branch from `main` therefore carries approvals, and only reviewers without a current or carried approval run again. A fresh review is required for any edit, rename, mode change or whitespace change to a PR file, including one inside a merge commit; a base-branch change to a PR-touched file; a force-push that removes the approved commit; a PR touching more than 500 paths; or an empty change (ADR-0006).

The reviewers run automatically in GitHub Actions (`.github/workflows/ai-review.yml`) and can also be run locally with `/review-pr <number>`.

### Single-pass review

Each reviewer checks the same things on every pass; the rules below cut repeat rounds, not checks.

- **First pass is complete.** A reviewer reports every finding it has in its first review of a PR, at every severity. It never holds findings back for a later round.
- **NITs don't block.** A NIT never makes a verdict REQUEST_CHANGES on its own; the reviewer APPROVEs and lists the nits. BLOCKER and MAJOR findings still mean REQUEST_CHANGES.
- **Re-reviews are scoped.** On a new head, a reviewer reads its latest review (`gh pr view <n> --comments`), verifies that each earlier finding is fixed, and checks the new commits for regressions. It doesn't re-audit unchanged code for new style findings. A BLOCKER or MAJOR it finds anywhere, including a safety rule from `CLAUDE.md`, is still reported.

## Responding to review

- The owning agent fixes findings in new commits on the same branch (no force-push once review has started).
- Disagreements are answered in the review comment thread with reasoning. The tech lead settles disputes.
- Deferring a MINOR finding requires an issue link.

## Definition of done

From `docs/planning/06`: implementation and review complete; tests pass; academic review done when meaning changes; accessibility and privacy impact considered; telemetry and rollback noted; user-facing wording reflects uncertainty; traceability (requirement IDs) updated in the PR.
