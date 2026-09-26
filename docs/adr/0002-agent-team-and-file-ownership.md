# ADR-0002: Agent team with enforced file ownership and a review panel

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Product owner, tech lead
- **Related:** planning doc 04 (rule authors must not self-approve), doc 06 definition of done

## Context

Development is done largely by Claude Code subagents. Without boundaries, agents drift across layers, and one agent can both write and approve a change.

## Decision

- Each builder agent owns a disjoint set of paths in `.github/ownership.json`.
- Ownership is enforced by a Claude Code PreToolUse hook, a pre-push hook, and a required CI check keyed on the branch prefix.
- Read-only reviewer agents post verdicts on every PR; a required "AI review gate" check blocks merging until every required reviewer approves the current head commit.
- `main` is protected by a GitHub ruleset.

## Consequences

- Cross-area features are split into ordered, single-owner PRs. More PRs, but each is small and reviewable.
- Reviews cost model usage on every push to an open PR.
- Mechanical repo-wide changes need the `ownership-override` label and a linked justification.

## Revisit when

Review cost or PR fragmentation measurably slows delivery, or a human reviewer joins the team.
