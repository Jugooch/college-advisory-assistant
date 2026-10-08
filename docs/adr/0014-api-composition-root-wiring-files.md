# ADR-0014: Split the API composition root into wiring files

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Tech lead, repo owner
- **Related:** standards 01, 02, 05, issues #443, #412, #399, PRs #437, #442

## Context

Standards 01, 02, and 05 say `apps/api/src/container.ts` is the only place that constructs repositories and services. Every new module adds imports and wiring to that one file, and it has reached the 250-line `max-lines` cap.

The last two modules worked around the cap instead of fixing it. PR #442 (#410) and PR #437 (#411) spread the whole `repositories` object into factories and built `Pick`/`Omit` return types so helper functions could share the work. That hides which repositories each service actually uses, and #412 (advisor actions) still has to add wiring.

The repo owner [approved](https://github.com/Jugooch/college-advisory-assistant/issues/443#issuecomment-6050030916) two steps: a temporary per-file `max-lines` override for `container.ts` (devops, PR #455, part of #443), and then a real split under a standards change, with the override removed before #412.

The options were:

1. **Raise the cap for `container.ts` for good.** This is the smallest change, but the file keeps growing with every module, and the size limit stops meaning anything for it.
2. **Let each module wire itself**, for example a `<module>.wiring.ts` inside `modules/<module>/`. Construction would then be spread across 20 folders. A module could construct another module's services, and nothing would show the whole graph.
3. **Split the composition root into a few area files** in one folder, called only by `container.ts`. Construction stays in one place, and `container.ts` still shows how the areas connect.

## Decision

### Temporary size exception

Until #443's split lands, `apps/api/src/container.ts` may be up to **260 lines**, the smallest cap that #442 needs. The cap is set by a per-file `max-lines` override in `eslint.config.mjs` and listed in standard 01 §Size. No other file gets it. The devops-engineer removes the override as soon as the split merges, before #412 starts. #412 must not add wiring to `container.ts` while the override exists.

### Composition root

**Option 3.** The API composition root is `apps/api/src/container.ts` plus the files in `apps/api/src/wiring/`. "Only the composition root constructs services and repositories" stays true under that definition (standard 01 §Composition root).

### Location and naming

- Files are `apps/api/src/wiring/<area>.wiring.ts`, kebab-case. An area is a cohesive group of modules named for what it serves, for example `academic-reads.wiring.ts`, `plans.wiring.ts`, or `cases.wiring.ts`. It isn't one file per module.
- Each file has **one exported function**, `wire<Area>(…)`, plus its parameter and return types. It returns the controllers it builds, and any services another area needs, as a named interface. It doesn't return `Pick<Controllers, …>`.

### What a wiring file may do

- Call `create*` factories from `modules/*/*.service.ts` and `modules/*/*.controller.ts`, and pass them repositories, other services, the clock function, and validated configuration values.
- Choose an implementation from a validated configuration value, for example the session resolver by `AUTH_MODE`. The choice carries a `// SECURITY:` or `// SAFETY:` comment when it affects either.
- Import types only (`import type`) from `container.ts`, such as `Repositories` and `ContainerOptions`.

### What a wiring file may not do

- **No logic.** No loops, data transformation, validation, or business rules. Code that decides something goes in a service or a `.logic.ts` file (ADR-0008).
- **No I/O beyond construction.** It doesn't construct the database or repositories, query anything, read `process.env`, call the clock, or log. `createRuntimeDependencies` in `container.ts` stays the only place that opens the database and builds repositories.
- **No module state.** No singletons, caches, or module-level variables. Every call builds a new graph.
- **No imports from** another wiring file, `routes`, `plugins`, `app.ts`, `server.ts`, Fastify, Drizzle, or `pg`. A service two areas share is built once, in `container.ts` or the owning area's `wire<Area>`, and `container.ts` passes it to the other area as an argument. That way `container.ts` shows every connection between areas.
- **Pass narrow dependencies.** Each factory gets the repositories it uses by name, not a spread of the whole `repositories` object. The api-engineer removes the spreads and `Omit` types from #437 and #442 as part of the split.

### Who imports it

Only `container.ts` imports a wiring file, plus that file's own colocated test. `container.ts` keeps `createContainer`, `createRuntimeDependencies`, and the `Controllers`, `Repositories`, `ContainerOptions`, and `AppDependencies` types, and calls each `wire<Area>` once.

### Size

Every composition-root file stays under the standard 250-line cap with no override. When a wiring file nears the cap, split the area. Don't raise the limit.

## Consequences

- New modules add a few lines to one area file instead of growing `container.ts`. #412 adds its wiring without a workaround.
- Factories get named dependencies again, so a reader sees which repositories a service touches.
- One more folder and role suffix in the API.
- `container.test.ts` keeps covering the whole graph. A wiring file needs its own test only when it chooses an implementation from configuration.
- Tooling (devops-engineer, #443):
  - `scripts/lib/structure-rules.mjs`: allow `apps/api/src/wiring/*.wiring.ts` and its `.test.ts`, and nothing else in that folder.
  - `config/eslint/layer-boundaries.mjs`: forbid importing `**/*.wiring` outside `apps/api/src/container.ts` and wiring tests. In `*.wiring.ts`, forbid other `**/*.wiring`, `**/*.routes`, `**/plugins/*`, `**/app`, `**/server`, `fastify`, `drizzle-orm`, `pg`, value imports from `**/container`, and runtime imports from `@caa/db` (types only). Apply the clock and environment determinism bans.
  - Remove the temporary 260-line override for `container.ts` from `eslint.config.mjs` right after the api-engineer's split merges, before #412. The override lives in a devops-owned file, so the api-engineer can't remove it in the split PR.
- Until the tooling lands, review enforces this ADR.

## Revisit when

- `container.ts` nears the cap again only from area calls and types. That would mean the area split is too fine, or the shared types need a home.
- The worker's `main.ts` hits the same limit. It would then follow this pattern under its own folder.
- A dependency-injection library is proposed. That would replace this ADR.
