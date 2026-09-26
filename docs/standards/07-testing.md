# 07 · Testing

## What must be tested

| Code                         | Test type                                                                         | Required                    |
| ---------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `packages/engine`            | Unit, every branch                                                                | Yes. Coverage threshold 95% |
| `packages/domain` models     | Unit: valid input, each invariant violation                                       | Yes. Coverage threshold 90% |
| API services                 | Unit with injected fakes                                                          | Yes                         |
| API routes                   | HTTP-level via `app.inject` for success and each error code                       | Yes                         |
| Repositories and mappers     | Mapper unit tests; repository integration tests against Postgres once CI has a DB | Mappers yes                 |
| Worker jobs and adapters     | Unit with fixture batches, including malformed and out-of-order input             | Yes                         |
| Web components               | Component tests for non-trivial logic and accessibility-relevant states           | When logic exists           |
| Acceptance cases (AC01–AC20) | `tests/acceptance`, owned by QA                                                   | One file per case           |

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

## Running

```bash
pnpm test               # all projects
pnpm test:coverage      # with thresholds (CI runs this)
pnpm vitest run packages/engine   # one workspace
```
