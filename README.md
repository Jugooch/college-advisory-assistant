# College Advisory Assistant

Verified Advising Runtime: an institution-sponsored web app that helps students plan next term. A conversational interface handles intent; a deterministic engine makes every academic decision, and anything uncertain is shown as uncertain and routed to an advisor.

## Quick start

Prerequisite for working with the agent team: the Claude Code sandbox (bubblewrap and socat on Linux/WSL2). See [Sandbox setup](docs/team/README.md#sandbox-setup-once-per-machine).

```bash
nvm use                                   # Node 22
pnpm install
cp infra/env.example .env                 # local settings (synthetic data only)
docker compose -f infra/docker-compose.yml up -d   # local Postgres (synthetic data only)
pnpm dev                                  # web :3000, api :4000, worker
pnpm verify                               # everything CI checks
```

### Seed and sign in locally

Everything below uses synthetic data only. Never load real student records on a development machine.

```bash
docker compose -f infra/docker-compose.yml up -d   # local Postgres
cp infra/env.example .env
set -a && . ./.env && set +a                       # export the variables into this shell
pnpm --filter @caa/db db:migrate                    # create the tables
pnpm --filter @caa/db db:seed                       # synthetic colleges, users, students, catalog, records, audits (safe to re-run)
pnpm dev                                            # web :3000, api :4000, worker

# Who am I? Sign in as the synthetic advisor (AUTH_MODE=dev)
curl -H 'Authorization: Bearer dev-token-advisor' http://localhost:4000/v1/me
```

`db:seed` refuses to run when `NODE_ENV=production`, and the API refuses to start with `AUTH_MODE=dev` in production. The available tokens, and the synthetic identities they sign in as, are defined by `DEV_AUTH_TOKENS` in `.env`.

### Try the seeded academic scenarios

The seed gives tenant _Demo State University_ a small catalog, ruleset `demo-2026.1`, and two synthetic students. The expected results below come from the rules: the seeded policy and prerequisites, the golden corpus (`packages/test-kit/src/golden/cases/`), and the planning docs. They were not produced by running the engine. If the app shows something else, that's a finding to report, not an expectation to change.

**Seeded times are relative to the seed run.** `db:seed` reads the clock once and times every seeded record from it: SYN-000001's record is 3 hours old and its audit ran against exactly that record, so it's within the API's 24-hour source-age limit (`ACADEMIC_SOURCE_MAX_AGE_MS`) right after seeding. SYN-000002's audit ran against a record 17 days older than its latest one. The offsets are in `SEED_TIME_OFFSETS_MS` (`packages/db/src/seed/dev-seed-record-times.ts`).

**Re-seeding refreshes the scenarios.** After 24 hours SYN-000001's record is stale too, and course checks return 409 `STALE_SOURCE`. Run `pnpm --filter @caa/db db:seed` again: each run adds a fresh snapshot and audit revision for both students as new rows. Nothing existing is changed, and the app reads the newest. The catalog, rules, policy, terms, and attempts are fixed and kept as they are. To start from a clean database instead, run `docker compose -f infra/docker-compose.yml down -v`, then migrate and seed again.

**API settings.** Run the API with the values from `infra/env.example` (`AUTH_MODE=dev`):

- `ACTIVE_RULESET_VERSION=demo-2026.1`, the seeded ruleset. Without it, course checks fail with `INTERNAL_ERROR`.
- `ACADEMIC_SOURCE_MAX_AGE_MS`, the source-age limit. It defaults to 24 hours outside production. It isn't in `infra/env.example` yet (#146).
- `AUDIT_RECORD_MAX_SKEW_MS`, the largest record/audit gap still treated as current. It is 1 hour in the example, and the API accepts at most 7 days.

**In the browser.** Open `http://localhost:3000/dev/sign-in` and enter a dev token (`dev-token-student` or `dev-token-advisor`). Then open `/overview?studentId=<seeded student ID>` for the academic summary, and `/course-checks?studentId=<seeded student ID>` to pick courses and see each check separately. The course check page doesn't choose variable credits yet, so the credit choices in scenario 3 run through the API only.

| Seeded ID                              | What it is                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `30000000-0000-4000-8000-000000000001` | SYN-000001, signs in with `dev-token-student`; the advisor is assigned                     |
| `30000000-0000-4000-8000-000000000002` | SYN-000002, has a deliberately stale audit; the advisor is assigned                        |
| `50000000-0000-4000-8000-000000000102` | DEMO-MATH 102 (3.00), needs DEMO-MATH 101 ≥ C                                              |
| `50000000-0000-4000-8000-000000000301` | DEMO-PHYS 301 (4.00), needs DEMO-PHYS 201 ≥ C and (DEMO-MATH 102 ≥ C or DEMO-MATH 101 ≥ C) |
| `50000000-0000-4000-8000-000000003010` | DEMO-PHYS 301L (1.00 lab)                                                                  |
| `50000000-0000-4000-8000-000000001101` | DEMO-ENGL 101 (3.00)                                                                       |
| `50000000-0000-4000-8000-000000000390` | DEMO-IND 390 (variable, 1.00–3.00)                                                         |

Policy: in-progress prerequisites allowed, `MOST_RECENT` repeats, credit load 12.00–18.00. SYN-000001 took DEMO-MATH 101 twice (D in 2025FA, then B in 2026SP) and is taking DEMO-PHYS 201 in 2026FA.

Course checks are `POST /v1/students/:studentId/course-checks` with a body such as `{"courseIds": ["50000000-0000-4000-8000-000000000102"]}`. The academic summary is `GET /v1/students/:studentId/academic-summary`. For example:

```bash
curl -X POST http://localhost:4000/v1/students/30000000-0000-4000-8000-000000000001/course-checks \
  -H 'Authorization: Bearer dev-token-student' -H 'Content-Type: application/json' \
  -d '{"courseIds":["50000000-0000-4000-8000-000000000102"]}'
```

1. **A repeat counts the later grade: DEMO-MATH 102 → PASS.** Check DEMO-MATH 102 for SYN-000001. Under `MOST_RECENT`, the 2026SP B counts over the 2025FA D, and B meets the C minimum, so the prerequisite is PASS. This is golden case **GC-REP-001** with the same inputs. SYN-000001's academic summary shows the audit reflecting the record (PASS): the audit is pinned to the current snapshot with no time gap, which is within any configured skew (a gap exactly at the skew is still fresh, **GC-STALE-002**), and it has the same program and catalog (planning/07 §Consistency model).
2. **An in-progress prerequisite: DEMO-PHYS 301 → CONDITIONAL, never PASS.** Check DEMO-PHYS 301 for SYN-000001. DEMO-PHYS 201 is in progress and policy permits progression, so that leaf is CONDITIONAL with `IN_PROGRESS_MIN_GRADE` (**GC-IP-001**). The OR branch passes: DEMO-MATH 102 has no attempt, so that leaf alone fails (**GC-MIN-004**), but DEMO-MATH 101's counted B passes (**GC-REP-001**), and an OR with any PASS is PASS (issue #55; **GC-EXP-005** shows a passed alternative settling an OR). An AND with no FAIL or UNKNOWN and at least one CONDITIONAL is CONDITIONAL (issue #55 three-valued tables).
3. **Credit load for 2027SP.** Check DEMO-MATH 102, DEMO-PHYS 301, DEMO-ENGL 101 and DEMO-IND 390 together for SYN-000001. Only the credit-load result (`setResults.creditLoad`) is stated here. The fixed courses differ from the golden cases' but carry the same 10.00 credits.
   - With no credits chosen for DEMO-IND 390: **UNKNOWN `VARIABLE_CREDIT_UNSELECTED`**, with no total shown. 10.00 fixed + 1.00–3.00 = 11.00–13.00 straddles the 12.00 minimum (**GC-VAR-001**, the same totals).
   - With `creditSelections` setting `selectedCreditsHundredths: 200` (2.00) for DEMO-IND 390: **PASS at 12.00**; the minimum is inclusive (**GC-LOAD-005**).
   - Adding DEMO-PHYS 301L and choosing 300 (3.00): **PASS at 14.00**. 3.00 + 4.00 + 3.00 + 1.00 + 3.00, and the lab carries its own credit (**GC-LOAD-001**).
4. **A stale audit: SYN-000002 (sign in with `dev-token-advisor`).** SYN-000002's audit ran against a record 17 days older than its latest record, which carries a DEMO-MATH 101 grade posted after the audit ran.
   - **Course checks return 409 `STALE_SOURCE`** and refer the student to an advisor: the audit's record time is older than the 24-hour source-age limit, so no validated result is given (planning/09 §Proposed freshness policies).
   - **The academic summary** shows the audit-reflects-record check as **UNKNOWN `AUDIT_STALE`**: the record changed after the audit by more than any allowed skew (the API accepts at most 7 days) (**GC-STALE-001**; planning/07 §Consistency model). The requirement states are still the audit's, as of when it ran, and must be shown as needing verification, never as current standing.

## Where things are

| Read this                                          | For                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                           | Repo layout, commands, and the non-negotiable rules                                   |
| [`docs/planning/`](docs/planning/00-start-here.md) | Product scope, requirements, architecture, and SDLC gates                             |
| [`docs/standards/`](docs/standards/README.md)      | Binding coding standards: structure, naming, comments, data objects, APIs, tests, PRs |
| [`docs/team/`](docs/team/README.md)                | The agent team, file ownership, handoffs, and the review panel                        |
| [`docs/adr/`](docs/adr/)                           | Architecture decision records                                                         |

## Contributing

Every change goes through a pull request from a branch named `<owner-agent>/<issue>-<slug>`. CI checks quality, tests, the build, file ownership, and the PR title, and an AI reviewer panel must approve the head commit before merge. See [`docs/standards/08-git-and-pull-requests.md`](docs/standards/08-git-and-pull-requests.md).
