# ADR-0016: Browser end-to-end tests and the one-command local demo

- **Status:** Accepted 2026-10-09. The repo owner confirms or overrides the tech-lead choices listed on the S7 umbrella issue.
- **Date:** 2026-10-09
- **Deciders:** Tech lead; repo owner (sprint S7 decisions 1–2: a local demo only, no hosted environment)
- **Related:** FR-01, FR-08, FR-11, FR-12, NFR-02, NFR-05; new AC48–AC51; T08; planning/11 (accessibility), planning/13 §Test families; ADR-0003, ADR-0009, ADR-0013, ADR-0015; standards 01, 06, 07, 08; issues #577 (umbrella), #578, #581–#585, #590–#593

## Context

Sprint S7 makes the S1–S6 product dependable and showable as a local demo. Every test today runs in Vitest: unit, component, integration against PostgreSQL, acceptance through `@caa/api/testing`, and T06 evaluations. Nothing drives the real web app in a browser. So the student flow (sign in → overview → planner → chat → draft → case) and the advisor flow (queue → claim → resolve) are proven only in pieces, and the accessibility checks stop at lint and component tests (standard 06).

Browser tests need a browser binary. Playwright downloads its browsers from its own CDN, and the agent sandbox allows only GitHub and npm (ADR-0003). We checked on the owner's machine on 2026-10-09:

- From the sandbox, both Playwright download hosts are refused. `@playwright/test` and `@axe-core/playwright` come from npm, so they install.
- A Chromium build that is already in the user's Playwright cache (`~/.cache/ms-playwright`) starts headless inside the sandbox. A server listening on loopback is reachable from it.
- GitHub-hosted CI runners have open network access, and the `Tests` job already runs a PostgreSQL service.

A demo also needs more than one student to be convincing: a student on track, one blocked by a prerequisite, one with UNKNOWN data, a saved plan that has gone stale, and an advisor with cases to review. Today a demo means four manual steps and one synthetic student (README §Seed and sign in locally).

The options for getting a browser were:

- **(a) Add the Playwright CDN to the sandbox allowlist.** Agents could install browsers themselves, but every agent shell would gain a new download host, which widens ADR-0003 for one tool.
- **(b) A system Chromium from the OS package manager.** Its version drifts away from the one Playwright pins, and a different machine gets a different browser.
- **(c) CI installs the pinned browser; locally the user installs it once, outside the sandbox.** Agents never download browsers. They run e2e locally only when the browser is already in the cache and PostgreSQL is up, and otherwise read the CI run.

## Decision

**Option (c).** ADR-0003's allowlist doesn't change.

### 1. Playwright, Chromium only, in `tests/e2e/`

- Browser tests use `@playwright/test` with Chromium only, pinned in `tests/package.json`. They are owned by the QA engineer.
- Layout: `tests/e2e/acNN-<description>.e2e.ts` (one acceptance case per file), `tests/e2e/support/*.ts`, and `tests/e2e/playwright.config.ts`. The `.e2e.ts` suffix keeps the files out of Vitest.
- E2e tests drive only the browser. They import nothing from `apps/*` or `packages/*`, except `@caa/domain` enums for display codes. Expected results come from planning/13 and the acceptance case, never from the seed or the app (standard 07 §Academic test independence).
- **Stack under test.** The Playwright `webServer` starts the API and the web app with `AUTH_MODE=dev`, `CONVERSATION_MODEL=demo` and the dev seed, in development mode. They never run in production mode, because both the demo model and dev auth refuse production, and that refusal stays.
- **Determinism.** One worker, no retries, and each spec uses its own synthetic student, or creates the state it needs through the UI. Specs never assert on the clock. A trace and a screenshot are kept on failure.
- **Known findings** use the existing register (`tests/support/known-findings.ts`) through a Playwright helper that runs the test as `test.fail` while the register lists it. The register's guard counts those declarations too (standard 07 §Known findings).

### 2. Accessibility checks with axe

- Each e2e step that shows a new page or a new chat result runs `@axe-core/playwright` with the WCAG 2.2 AA tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`). Any violation fails the test.
- No axe rule is disabled. A violation that needs a web fix becomes a frontend issue and a known-findings entry until it's fixed.
- Axe complements the accessibility reviewer and the manual assistive-technology testing in planning/13. It doesn't replace them.

### 3. Where e2e runs

- **CI:** a separate `E2E` job in `ci.yml`. It starts PostgreSQL, installs the pinned Chromium with `playwright install --with-deps chromium`, migrates, runs the dev seed, and then runs `pnpm e2e`. It uploads the Playwright report and traces as an artifact when the job fails. The job is a required check once the first spec lands.
- **`pnpm verify` doesn't run e2e.** It must keep working in the sandbox with no database and no browser. Standard 07 says this now, and CLAUDE.md will once `pnpm e2e` exists (#593).
- **Locally:** the user installs the browser once, outside the sandbox: `pnpm --filter @caa/tests exec playwright install chromium`. With that done and PostgreSQL up, `pnpm e2e` runs for the user and for agents. If the browser isn't cached, the agent doesn't try to install it. It pushes the branch and reads the `E2E` job's result and artifact with `gh`.

### 4. The one-command local demo

- **`pnpm demo`** (devops, `scripts/`) resets the local database, migrates it, loads the demo seed, starts the stack with `CONVERSATION_MODEL=demo`, `AUTH_MODE=dev` and the demo dev tokens, and prepares the dynamic state through the API. It refuses to run unless `DATABASE_URL` points at localhost and `NODE_ENV` isn't `production`. It needs no API key, no cloud account and no secret.
- **The demo seed** (data, `@caa/db`) is additive. `buildDemoSeedPlan` extends the dev seed with a few synthetic personas, and `db:seed:demo` writes it. `db:seed` and the fixtures built from it stay unchanged, so the api and acceptance tests that read seeded values don't ripple.
- **Academic results aren't seeded as fixtures.** The seed writes only source records, identities and assignments. A saved plan, its stale revision and the advisor's open cases are created by the demo's preparation step, through the real API as the persona would create them. The stale revision comes from the existing revise command, run for that persona. So every state shown in the demo was computed by the engine and the services, and nothing is hand-written.
- **`docs/demo.md`** is the walkthrough script. It names the personas, their dev tokens, and the steps and what each one shows.

## Consequences

- The core flows are proven end to end in a real browser, and accessibility gets an automated check on complete tasks, not just components.
- CI takes longer: one more job, plus a browser install of about a minute. It runs in parallel with `Tests`.
- Agents who can't run e2e locally depend on a CI round trip. The traces in the artifact make that round trip useful.
- A demo is one command, with personas that cover the situations planning/08 cares about most: PASS, a blocked prerequisite, UNKNOWN, STALE, and an advisor queue.
- Tooling work: the devops-engineer adds the `tests/e2e/` structure rules, the lint scope, `.gitignore` entries for the Playwright output, the root `e2e` and `demo` scripts, the demo dev tokens in `infra/env.example`, and the `E2E` job. The user makes `E2E` a required check in the ruleset.

## Revisit when

- A second browser or a mobile viewport matrix is needed for a pilot (planning/13 T08). Add it as a Playwright project.
- A hosted demo or staging environment is approved. That falls under E09, and it would replace the local-only guard in `pnpm demo`.
- E2e runs exceed about 10 minutes, or flake. Then split them into projects or shard them, but never add retries that hide a failure.
