# 07 · Testing

## What must be tested

| Code                         | Test type                                                                                  | Required                    |
| ---------------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| `packages/engine`            | Unit, every branch                                                                         | Yes. Coverage threshold 95% |
| `packages/domain` models     | Unit: valid input, each invariant violation                                                | Yes. Coverage threshold 90% |
| API services                 | Unit with injected fakes                                                                   | Yes                         |
| API routes                   | HTTP-level via `app.inject` for success and each error code                                | Yes                         |
| Repositories and mappers     | Mapper unit tests; repository integration tests (`*.integration.test.ts`) against Postgres | Yes                         |
| Worker jobs and adapters     | Unit with fixture batches, including malformed and out-of-order input                      | Yes                         |
| Web components               | Component tests for non-trivial logic and accessibility-relevant states                    | When logic exists           |
| Acceptance cases (AC01–AC20) | `tests/acceptance`, owned by QA                                                            | One file per case           |

Every bug fix adds a test that fails before the fix.

## Conventions

- Test files sit beside the code: `health.service.ts` → `health.service.test.ts`. Acceptance tests live in `tests/acceptance/acNN-<description>.test.ts`.
- `describe` names the unit (function or endpoint). `it` states the behavior as a sentence: `it('returns UNKNOWN when the seat rule is unavailable')`.
- Structure each test as arrange, act, assert, separated by blank lines. No comments needed for the phases.
- One behavior per `it`. Several `expect`s are fine if they describe one outcome.
- Use `@caa/test-kit` builders for data (`buildCheckResult({ state: CheckState.Fail, reasonCode: 'X' })`). No copy-pasted object literals across tests.
- Inject fakes through dependencies. Avoid `vi.mock` of modules; if you need it, the code under test probably has a hidden dependency.
- Deterministic: inject clocks and IDs. No real network, no sleeps.
- **Synthetic data only.** Names like "Demo State University" and fictional IDs. Never real student records.

## Academic test independence

The golden corpus and acceptance cases are written by the QA engineer from `docs/planning/13`, not by the engineer who wrote the rule. A test that re-implements the production logic to compute its expected value is not acceptable; expected values are stated literally and reviewed.

## Integration tests

Code that talks to PostgreSQL is tested against a real database, not mocks.

- **Naming and location:** `*.integration.test.ts` beside the code (for example `student.repository.integration.test.ts`). The structure rules accept the suffix only where database code lives: API modules and plugins, db mappers and repositories, and worker jobs and adapters.
- **How they run:** a separate Vitest project named `integration`. A global setup (`scripts/test/integration-global-setup.mjs`) creates a fresh database per run, applies the Drizzle migrations with `pnpm --filter @caa/db db:migrate`, points `DATABASE_URL` at it, and drops it afterwards. Tests read `process.env.DATABASE_URL`, connect in `beforeAll`, and close in `afterAll`.
- **Locally:** without `DATABASE_URL` the integration project is reported as skipped. To run them, start Postgres with `docker compose -f infra/docker-compose.yml up -d` and export `DATABASE_URL` (see `infra/env.example`).
- **In CI:** the `Tests` job provides a Postgres service. A missing `DATABASE_URL` in CI fails the run instead of skipping.
- **Data:** synthetic only, built with `@caa/test-kit`. Each test file sets up the rows it needs; never depend on another file's data.

## Acceptance tests

`tests/acceptance/acNN-<description>.test.ts`, one case per file, written by the QA engineer from `docs/planning/13`. Shared harnesses live in `tests/support/*.ts`. They reach apps only through their documented `@caa/<app>/testing` entry points (standard 01), and they keep their own in-memory fakes so the oracle stays independent of the code under test.

## Running

```bash
pnpm test               # all projects
pnpm test:coverage      # with thresholds (CI runs this)
pnpm vitest run packages/engine   # one workspace
pnpm vitest run --project integration   # database tests (needs DATABASE_URL)
```
