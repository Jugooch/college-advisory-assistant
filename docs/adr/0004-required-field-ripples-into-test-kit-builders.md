# ADR-0004: Required-field ripples into test-kit builders

- **Status:** Accepted; Amendment 1 superseded 2026-10-06 by ADR-0009 Amendment 1 (#255, #333); Amendment 3 added 2026-10-08 (#488)
- **Date:** 2026-09-28
- **Deciders:** Tech lead
- **Related:** ADR-0002 (amends its override consequence), issue #108, PRs #70, #104, #105

## Context

ADR-0002 gives each agent a disjoint area and allows the `ownership-override` label only for repo-wide mechanical changes. One narrower cross-area change keeps recurring. When a domain PR adds a required field to a model, the qa-owned test-kit builder for that model stops compiling. Separate PRs can't keep `main` green in either order: the builder can't set a field the schema doesn't have yet, and the schema can't require a field the builder doesn't set. The orchestrator fixed the builder inside the domain PR under the override on #70, #104, and #105 with no linked authorization, and the architecture reviewer blocked #105 for it.

The options were:

- **A named override case.** The orchestrator makes the builder fix inside the domain PR, with tight limits.
- **A staged rollout.** The field starts optional, each owner adopts it, and a final PR makes it required.

## Decision

Required-field ripples into test-kit builders are a named `ownership-override` case, defined in standard 08 §Ownership overrides:

- Only the orchestrator makes the edit.
- It touches only the builder defaults, the builder's literal test, and, for a new ID, a `syntheticId` kind.
- The default is conservative: `null` for a nullable field.
- The edit is its own commit, and the PR body links #108 with fixed wording.

When the ripple goes further than that, or no conservative default fits, the staged rollout is required.

The staged rollout isn't the default because:

- It puts an optional field on `main`, which standard 04 rule 10 forbids. For safety fields such as credit bounds, an omitted value is exactly the guess the product must not make.
- It triples the PRs and review rounds for a one-line builder change that the domain change fully determines.
- Its last step, making the field required, is easy to lose.

No builder agent gains access to another area. The edit hook still blocks them, and the change is limited to a closed list of files that reviewers can check.

This retroactively covers #70 (`lowestPassingLetterGrade: null`) and #104 (`studentSnapshotId`, with a new `studentSnapshot` synthetic ID kind). Both fit the rules. #105 is covered once its body links #108 as standard 08 requires.

## Consequences

- A domain PR that adds a required field stays atomic and `main` stays green.
- Reviewers have a closed file list to check the override against. Anything outside it is a BLOCKER.
- qa-engineer owns the default after the merge and may change it in its own PR.
- A ripple into engine, db, API, or acceptance code still takes several PRs, except the interface ripple that Amendment 3 allows.

## Revisit when

- The override is used for anything outside the named files.
- Builders start carrying defaults that qa-engineer later has to correct.
- A human reviewer joins and could approve cross-area PRs directly.

## Amendment 1 (2026-09-29, issue #252): seed-mirror ripples

**Status: superseded 2026-10-06** by ADR-0009 Amendment 1. #255 builds the api seed fixtures from the seed plan, so no seed change needs an api edit, and #333 retired the case in standard 08. The text below is kept as the record of the decision.

**Related:** ADR-0009, standard 08 §Seed-mirror ripple (retired), issues #147, #216, #217, #229, #241, #253, #254, #255.

**Context.** `apps/api/src/testing/seed-scenario-fixtures.ts` (#147) is a hand copy of the dev seed's academic records. `seed-scenario-fixtures.test.ts` deep-compares it with the seed plan from `@caa/db/testing`. The copy can't import that entry itself, because lint bans `./testing` imports in every non-test file under `apps/*/src/**` (ADR-0009). So each change to seeded academic data needs three edits in one PR: the db seed (data-engineer), the api mirror (api-engineer) and sometimes the test-kit builder default (qa-engineer). Either order of separate PRs breaks `main`. Examples are #216 (DEMO-PHYS 301L's credits included in DEMO-PHYS 301) and the seed steps of the #229 and #241 staged rollouts. The decision above covers builder ripples only.

The options were:

- **(a) A named seed-mirror ripple override.** The orchestrator applies the mirror change, and the builder default if needed, in the data PR, under the same kind of limits as a required-field ripple.
- **(b) The structural fix.** The api fixtures build from the seed plan through `@caa/db/testing`. This needs standard 01 and ADR-0009 to allow imports from `apps/<app>/src/testing/**`, a devops lint exception, and an api refactor.

**Decision: (a) now, and (b) as a follow-up that retires (a).** (b) removes the ripple for good, but it needs three PRs from three owners in order (#253, #254, #255). Waiting for them would block #216's seed part, #217, #229 and #241 for the rest of S4. (a) unblocks them now, and it is bounded the way the original decision is:

- only the orchestrator edits;
- only when the data PR changes the seed plan and the mirror test fails without the edit;
- a closed file list, with values copied literally from the seed;
- its own commit, and fixed PR-body wording citing #252.

Standard 08 §Seed-mirror ripple has the rules. CI already enforces the "authorized by" link for every override, so no tooling change is needed for (a).

**Consequences.**

- #216, #217, #229 and #241 can each land their seed change as one PR, and `main` stays green.
- The mirror stays a hand copy until #255 lands. A seed change that breaks any other api test is outside the case, so that owner changes its code first.
- When #255 merges, the tech lead removes the case from standard 08 and marks this amendment superseded (#333; ADR-0009 Amendment 1).

## Amendment 2 (2026-09-29, issue #261): wording-map ripples

**Related:** standard 06 §Shared code, standard 08 §Wording-map ripple, planning/10, planning/11, issues #212, #218, #219, #220, #261, PRs #251, #260.

**Context.** The web's reason-code wording map, `apps/web/src/shared/utils/reason-code-wording.ts`, is typed `Record<ReasonCode, ReasonWording>`. Its test fails when a code has no entry or an entry has no code. The second half of #212 adds the scheduling reason codes, such as `MEETING_CONFLICT`, `TRANSITION_TIME_UNDEFINED`, `MEETING_TIME_UNKNOWN` and `MEETING_LOCATION_UNKNOWN`. Neither the domain PR nor a web PR can land first without breaking `main`, and engine #218–#220 wait on it. Unlike a builder default, the missing piece is student-facing wording, which only the frontend-engineer may write.

The options were:

- **(a) A named wording-map ripple override.** The frontend-engineer writes the exact wording in a comment, and the orchestrator applies it literally in the domain PR.
- **(b) A tolerant map.** Make the map `Partial`, and render a generic fallback for a code with no wording.
- **(c) A staged code.** The web map keys on its own list of displayable codes, and the domain adds codes behind it.

**Decision: (a).** Standard 08 §Wording-map ripple has the rules. (b) and (c) give up the compile-time guarantee that every code the API can send has wording the frontend-engineer wrote. A generic fallback can't state a FAIL's remediation, and a fallback worded for UNKNOWN would understate a FAIL. The generic text itself is exactly the kind of free wording that planning/10 keeps out of consequential results. (a) keeps the guarantee and keeps authorship with the owner. The orchestrator only transcribes, and reviewers check the text against the linked comment. CI already enforces the "authorized by" link.

**Consequences.**

- The second half of #212 lands as one domain PR with a separate web commit, and `main` stays green.
- Every added code ships with owner-written wording, and the existing test still bans overclaiming words.
- A change to web code other than the map and its test is outside the case.

## Amendment 3 (2026-10-08, issue #488): interface ripples

**Related:** ADR-0002 (amends its override consequence again), standards README §Hard limits, standard 08 §Interface ripple, `.claude/hooks/enforce-ownership.mjs`, `scripts/check-ownership.mjs`, issues #399, #468, #488, PR #486.

**Context.** Some cross-package interfaces add a member as optional while it rolls out, for example a `packages/db` repository method. Dependents guard it with `if (!repo.findX)`, and their test fakes leave it out. #468 step 3 (PR #486) makes the revision, live-case and queue lookups required. Neither order of single-owner PRs compiles:

- If the db PR lands first, the api guards become `@typescript-eslint/no-unnecessary-condition` errors, and the api and acceptance fakes that leave the member out fail typecheck.
- If the dependents land first, they can't drop the guards, because calling a member that may be undefined doesn't compile while it's still optional.

The architecture reviewer blocked #486 because no named case covered the api and `tests/support` edits. Unlike the earlier cases, this ripple reaches code areas (api, engine, db, acceptance) rather than a closed list of files. Fixing it also needs the owners' judgment about which tests cover the absent-member behavior.

The options were:

- **(a) A named interface-ripple override.** Each dependent owner's agent makes its own minimal edits as a separate commit on the interface owner's branch, under tight limits.
- **(b) A staged rollout.** This is how the optional member got onto `main` in the first place. Its final step is exactly this ripple, so staging again doesn't remove it.
- **(c) A tech-lead ruling per PR.** This unblocks one PR at a time, but each ruling sets limits from scratch, and reviewers have no standing rule to check against.
- **(d) A temporary lint suppression on the guards.** The standards README forbids disabling a rule to make code pass, and suppression doesn't fix the fakes that fail typecheck.
- **(e) The orchestrator makes the dependent edits**, as in the earlier cases. Those cases are transcriptions into fixed files. Here the edits are in code, and deciding which tests to remove takes the owner's judgment.

**Decision: (a).** Standard 08 §Interface ripple has the rules:

- The only edits allowed are removing absent-member guards and the tests of that absent-member behavior, and adding the member to test fakes and stubs.
- There is no other behavior change in any dependent area.
- There is one commit per owning area, and that area's agent builds it.
- The PR carries the `ownership-override` label, and its body cites #488 and lists each out-of-area file.

Several agents committing to one owner's branch is safe for these reasons:

- The PreToolUse edit hook keys on the agent, not the branch, so each agent can still edit only its own area.
- The CI ownership check, keyed on the branch prefix, rejects any out-of-area file unless the PR has the label and its body names an authorization (ADR-0002, standard 08).
- One commit per area lets reviewers check each owner's edits against the rules on their own.

**Consequences.**

- #486 lands as one db PR with separate api and qa commits, and `main` stays green.
- Reviewers check each out-of-area file against the allowed edits. A new branch, new logic, a refactor or a new test case in a dependent area is a BLOCKER.
- If a dependent needs more than guard removal and fake additions, the case doesn't apply. That owner changes its code first in its own PR where it can. Otherwise the tech lead rules on the issue.
- Optional interface members stay a temporary rollout state with a tracked issue. This case only shortens their last step.

**Revisit when:**

- The case is used for edits other than guard removal and fake additions.
- One ripple spans more than two dependent areas, or the case comes up often enough that the optional-member rollout pattern itself should change.
- A human reviewer joins and could approve cross-area PRs directly.
