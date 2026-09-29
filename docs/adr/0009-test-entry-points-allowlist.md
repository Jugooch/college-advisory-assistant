# ADR-0009: Test entry points are an allowlist, and it includes `@caa/db`

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Tech lead
- **Related:** FR-03, standards 01 §Test entry points and 07 §Acceptance tests, issues #135, #147, PR #185

## Context

Standard 01 lets a workspace export a test-only `./testing` subpath, but it describes only `apps/<app>/src/testing.ts` (`@caa/api/testing`, `@caa/worker/testing`). PR #185 adds `@caa/db/testing`: a writer that loads the synthetic seed scenarios into the integration database. The API integration tests (#147) and the acceptance tests need it. The architecture review asked for the standard to allow it before merge.

The lint rule `TEST_ONLY = ['@caa/*/testing']` already bans every `./testing` import from production files, and its test covers `@caa/db/testing`. So the question is only about structure: which workspaces may publish a second entry point.

The options were:

1. **Keep apps only.** Tests outside `packages/db` would then need deep imports or their own copy of the table writes, and both are worse.
2. **Allow any workspace.** This is simple, but every package gets a second public surface, and review can't tell a justified one from a convenient one.
3. **Allowlist.** Name the workspaces in standard 01, and add `@caa/db` because it alone owns the tables and client that test data must go through.

## Decision

**Option 3.** A `./testing` entry point keeps the existing rules: a single `src/testing.ts` with no nested `index.ts`, exported as `"./testing"`, imported only by tests, lint-banned in production files, and never part of the production entry. It is allowed only in `apps/api`, `apps/worker`, and `packages/db`. Adding a workspace means amending the list in standard 01, with the reason in the PR.

`@caa/db/testing` only loads input data. Acceptance tests still take their expected results from the acceptance case (standard 07), never from the writer.

## Consequences

- PR #185 conforms once this lands. The db writer stays the single path for test data, reusing the seed's reference checks.
- The list is enforced by review until the convention check enforces it. Devops follow-up: fail `check:conventions` when a `package.json` outside the allowlist declares a `./testing` export, or when one points anywhere but `./src/testing.ts`, and update the `TEST_ONLY` comment in `config/eslint/layer-boundaries.mjs`, which still says "of the apps".

## Revisit when

A third library package needs test-only exports, which would suggest a dedicated test-support package instead of more entry points.
