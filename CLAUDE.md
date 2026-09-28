# College Advisory Assistant

Verified Advising Runtime: students plan next term through a conversational UI, while a deterministic engine makes every academic decision. Product scope, requirements, and gates live in `docs/planning/` (start at `00-start-here.md`).

## Repository layout

| Path                                          | Package                       | What lives here                                              | Owner agent       |
| --------------------------------------------- | ----------------------------- | ------------------------------------------------------------ | ----------------- |
| `apps/web`                                    | `@caa/web`                    | Next.js UI: pages, feature components, API call functions    | frontend-engineer |
| `apps/api`                                    | `@caa/api`                    | Fastify HTTP API: routes → controllers → services            | api-engineer      |
| `apps/worker`                                 | `@caa/worker`                 | Background jobs: source imports, validation runs, solver     | data-engineer     |
| `packages/domain`                             | `@caa/domain`                 | Data objects (schemas, types, enums) and shared invariants   | domain-engineer   |
| `packages/api-contract`                       | `@caa/api-contract`           | Endpoint definitions, request/response schemas, typed client | domain-engineer   |
| `packages/engine`                             | `@caa/engine`                 | Pure, deterministic verification and scheduling              | engine-engineer   |
| `packages/db`                                 | `@caa/db`                     | Tables, row mappers, repositories                            | data-engineer     |
| `packages/assistant`                          | `@caa/assistant`              | AI tool catalog, prompts, claim templates                    | ai-engineer       |
| `packages/test-kit`, `tests/`                 | `@caa/test-kit`, `@caa/tests` | Synthetic builders, golden corpus, acceptance tests          | qa-engineer       |
| `docs/`, `.claude/`, `CLAUDE.md`              | —                             | Standards, ADRs, agent team                                  | tech-lead         |
| `.github/workflows`, `scripts/`, root configs | —                             | CI, tooling, lint config                                     | devops-engineer   |

The authoritative ownership map is `.github/ownership.json`. A hook blocks agents from editing outside their area, and CI blocks PRs that do. Agent shell commands run in the Claude Code sandbox (ADR-0003): writes only inside the repo, no `.env` reads, and network limited to GitHub and npm. Credential stores are denied per machine in user settings (`docs/team/README.md`).

## Commands

```bash
pnpm install          # install everything
pnpm dev              # web on :3000, api on :4000, worker
pnpm verify           # everything CI runs: format, lint, conventions, typecheck, tests+coverage, build
pnpm lint             # ESLint (size limits, naming, comments, layer boundaries)
pnpm check:conventions  # file placement/role suffixes and comment tags
pnpm test             # Vitest across all workspaces
```

## Rules every agent follows

1. **Stay in your area.** Only change files your role owns. If a task needs changes elsewhere, stop and write a handoff (see `docs/team/README.md`). Never work around the ownership hook.
2. **Follow the standards.** `docs/standards/` is binding. Read the relevant file before writing code. If a standard seems wrong, raise it with the tech lead; don't deviate silently.
3. **One PR, one owner, one concern.** Branch `<owner>/<issue>-<slug>`, Conventional Commits, and the PR template filled in completely.
4. **Tests ship with the code.** No behavior change without a test that would fail without it.
5. **`pnpm verify` passes before any PR is opened.**

## Non-negotiable product safety rules

These come from `docs/planning/08` and `10`. Violating one is always a blocking review finding.

- UNKNOWN is never treated as PASS. Missing, stale, or conflicting data produces UNKNOWN or a referral, never a guess.
- The AI never produces consequential academic facts (eligibility, credits, grades, deadlines, readiness). Those render from structured, validated fields.
- Institutional systems are read-only. No code path writes to an SIS, audit, or registration system.
- Tenant and user identity come from the authenticated session on the server, never from request bodies.
- No real student data in development, tests, fixtures, logs, or prompts. Synthetic data only.
- The engine is deterministic: identical pinned inputs produce identical results (no `Date.now`, no randomness).
