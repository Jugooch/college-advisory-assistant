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
