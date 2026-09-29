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

`tests/acceptance/acNN-<description>.test.ts`, one case per file, written by the QA engineer from `docs/planning/13`. Shared harnesses live in `tests/support/*.ts`. They reach apps and the database only through the documented `./testing` entry points (standard 01 §Test entry points), and they keep their own in-memory fakes so the oracle stays independent of the code under test. `@caa/db/testing` only loads input data; expected results still come from the acceptance case, never from the writer.

## Golden corpus

The golden corpus is the independent oracle for the verification engine (planning/13 §Golden corpus design). The QA engineer owns it.

- **Format:** each case is validated by `packages/test-kit/src/golden/golden-case.schema.ts` and records:
  - its ID (`GC-` for development, `GH-` for holdout), rule family, title, requirement IDs and source versions;
  - its full synthetic inputs and the check to invoke;
  - the expected result for each check: state, reason code, and evidence where it matters;
  - `allowedAlternatives`, and `prohibitedClaims` given as `{ state, claim }`;
  - its rationale, with citations;
  - `reviewer` (`pending-academic-review` until an academic owner signs it) and the adjudication date.
- **Independence:**
  - Expected values come from the planning docs and from tech-lead decisions recorded on issues and PRs.
  - When the planning docs leave an expectation open, the tech lead rules on the issue and adds the ruling to planning/13 §Golden corpus design (Adjudication rulings). Cases cite the ruling ID, for example GR-01.
  - They're never computed with engine code.
  - Cases call the engine only through `@caa/engine`'s public API.
- **Findings:** a case the engine doesn't meet follows §Known findings.
- **Holdout (`tests/golden/holdout/`):**
  - It's frozen and versioned, and engine engineers don't read it.
  - A disagreement becomes a bug issue, never an edit.
  - A case used to diagnose a defect is "burned": it moves to the development set and is replaced.
  - `tests/golden/holdout-isolation.test.ts` fails if anything outside `tests/golden/` imports the holdout, or if IDs or inputs overlap with the development set.
- **Layout:** development cases go in `packages/test-kit/src/golden/cases/<rule-family>.cases.ts`, and runners in `tests/golden/*.test.ts`.

## Known findings

A finding is a golden case or an acceptance test whose planning-derived expectation the code doesn't meet yet. Golden and acceptance findings share one register, so open findings are counted in one place for the release gates.

- **Never weaken the test.** The expected value stays as adjudicated, and a `bug` issue goes to the owning engineer.
- **Register:** `tests/support/known-findings.ts` maps each finding key to its issue number:
  - a golden case (development or holdout): its case ID, for example `GC-PF-004`;
  - an acceptance test: `ACNN: <exact it title>`, for example `AC29: keeps CONDITIONAL end to end`. An acceptance file holds several tests, so the case number alone isn't enough.
- **Expected failure comes from the register.** The golden runners look up the case ID. A failing acceptance test is declared through the register's helper in `tests/support`, which looks up its key. Either way the test runs as `it.fails` while the register lists it, and as `it` otherwise. No test file hard-codes `it.fails`.
- **Guard:** a test fails if a register entry matches no golden case and no test declared through the helper.
- **Closing:** the fixing PR removes the entry, and nothing else in `tests/`. That uses `ownership-override` if the fix belongs to another owner (standard 08). If a tech-lead ruling settles the finding instead, the QA engineer re-adjudicates the case from the ruling and removes the entry.

## Running

```bash
pnpm test               # all projects
pnpm test:coverage      # with thresholds (CI runs this)
pnpm vitest run packages/engine   # one workspace
pnpm vitest run --project integration   # database tests (needs DATABASE_URL)
```
