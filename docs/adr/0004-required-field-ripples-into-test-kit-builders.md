# ADR-0004: Required-field ripples into test-kit builders

- **Status:** Accepted
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
- A ripple into engine, db, API, or acceptance code still takes several PRs.

## Revisit when

- The override is used for anything outside the named files.
- Builders start carrying defaults that qa-engineer later has to correct.
- A human reviewer joins and could approve cross-area PRs directly.

## Amendment 1 (2026-09-29, issue #252): seed-mirror ripples

**Related:** ADR-0009, standard 08 §Seed-mirror ripple, issues #147, #216, #217, #229, #241, #253, #254, #255.

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
- When #255 merges, the tech lead removes the case from standard 08 and marks this amendment superseded (#253).
