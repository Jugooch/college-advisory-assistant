# 01 · Repository structure and file naming

## Separation of concerns

The codebase is layered like MVC, with each concern in its own place.

| Concern                                             | Lives in                                                        | Never contains                                         |
| --------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| **Pages** (routes and screens)                      | `apps/web/src/app/**/page.tsx`                                  | Business rules, `fetch`, data transformation           |
| **UI components**                                   | `apps/web/src/features/*/components`, `apps/web/src/components` | API calls (receive data via props or hooks)            |
| **Shared display code** (used by several features)  | `apps/web/src/shared/{components,utils}`                        | Feature knowledge, API calls, hooks, actions           |
| **Server actions** (form posts that change state)   | `apps/web/src/features/*/actions/*.action.ts`                   | UI code, business rules                                |
| **Frontend API calls**                              | `apps/web/src/api/*.api.ts`                                     | UI code                                                |
| **HTTP contract** (endpoints, DTOs, client)         | `packages/api-contract`                                         | Business logic                                         |
| **Routes** (path → controller)                      | `apps/api/src/modules/*/*.routes.ts`                            | Logic of any kind                                      |
| **Controllers** (HTTP ↔ service translation)        | `apps/api/src/modules/*/*.controller.ts`                        | SQL, repositories, engine calls, business rules        |
| **Services** (business logic, orchestration)        | `apps/api/src/modules/*/*.service.ts`                           | HTTP types, SQL                                        |
| **Logic** (pure API-side functions)                 | `apps/api/src/modules/*/*.logic.ts`                             | I/O, clocks, randomness, logging, HTTP, SQL            |
| **Data objects** (models, enums, shared invariants) | `packages/domain`                                               | I/O of any kind, clocks, randomness, engine-only rules |
| **Academic rules**                                  | `packages/engine`                                               | I/O, clocks, randomness, a copy of a shared invariant  |
| **Persistence** (tables, mappers, repositories)     | `packages/db`                                                   | Business rules, HTTP                                   |
| **Background jobs and source adapters**             | `apps/worker`                                                   | HTTP, UI                                               |
| **AI tools, prompts, templates**                    | `packages/assistant`                                            | Direct database access                                 |

Dependencies point one way:

```
web ──► api-contract ──► domain
api ──► api-contract, engine, db, assistant ──► domain
worker ──► engine, db ──► domain
```

ESLint `no-restricted-imports` blocks every other direction. `packages/domain` depends on nothing but `zod`.

### Shared invariants

Academic rules live in the engine, with one exception (ADR-0005). A **shared invariant** is a rule that the engine must produce and a domain or contract schema must also enforce in a `.refine`. It's defined once, as an exported function in `@caa/domain`, because the contract can't import the engine. The limits:

- It's pure and total over domain types or `Pick`s of them, and returns a boolean or a domain enum value. It has no I/O, no clock, no randomness, and no module state, and it never throws.
- It encodes one rule from a planning doc, with a `// SAFETY:` comment citing the section. Loading policy, attaching evidence, and composing rules stay in the engine.
- It sits in the file that owns the type it's about: the `.enum.ts` for a rule over one enum's values, or the `.model.ts` of the model being checked. Adding a folder or a role suffix for it isn't allowed.
- The engine calls it and never restates it. Services get results from the engine, not from the function. Web never calls it to recompute a state.

A rule that only the engine needs stays in the engine. Generic helpers such as `isDistinct` aren't shared invariants and stay private to their file.

### Determinism in pure code

The engine, domain shared invariants, and `.logic.ts` files give deep-equal output for deep-equal input (NFR-01):

- **No clock, timer, randomness, or environment.** That means no `Date.now()`, argument-less `new Date()`, `performance`, `setTimeout`, `setInterval`, `setImmediate`, `Math.random`, `crypto`, or `process`. The caller passes the time in.
- **No locale.** Strings are ordered by UTF-16 code unit (`<` and `>`, or a bare `.sort()` on strings), never with `localeCompare` or `Intl`, because those depend on the runtime's locale data.
- **Input order doesn't matter.** Output never depends on the order of an input array or on `Map` or `Set` insertion order from unsorted input. Every sort of non-strings has an explicit comparator, and every order that reaches the output ends on a unique ID. A function that takes a collection has a test that shuffles its input and expects a deep-equal result.
- **Work is counted, not timed.** A bounded search takes a work cap as an argument, counts a documented unit, and returns the cap and the units used in its result. It never stops on elapsed time (ADR-0010).

## Folder layout per workspace

```
apps/api/src/
  server.ts               process entry: load env, build app, listen
  app.ts                  buildApp(): Fastify instance, not listening
  container.ts            composition root: the ONLY place that constructs services/repositories
  config/env.ts           validated environment
  plugins/*.plugin.ts     cross-cutting Fastify setup (errors, auth, request context)
  shared/*.ts             small HTTP helpers
  modules/<module>/
    <module>.routes.ts
    <module>.controller.ts
    <module>.service.ts
    <module>.mapper.ts    optional: domain ↔ contract DTO mapping
    <module>.logic.ts     optional: pure functions the services call (standard 05 §Logic)
    <module>.service.test.ts

apps/web/src/
  app/**/page.tsx|layout.tsx|...   Next.js reserved files only; no route.ts handlers
  api/<module>.api.ts               every call to the backend
  features/<feature>/components/*.tsx
  features/<feature>/hooks/use-*.ts
  features/<feature>/utils/*.ts
  features/<feature>/actions/*.action.ts   server actions ('use server')
  shared/components/*.tsx           app-specific display used by more than one feature or page
  shared/utils/*.ts                 app-specific pure helpers used by more than one feature or page
  components/ui/*.tsx               generic presentational primitives, no app knowledge
  lib/*.ts                          server infrastructure: API client, session cookie

packages/domain/src/
  enums/<name>.enum.ts
  models/<name>.model.ts
  index.ts

packages/api-contract/src/
  contracts/<module>.contract.ts
  client/*.ts
  define-endpoint.ts, envelope.ts, index.ts

packages/db/src/
  tables/<entity>.table.ts
  mappers/<entity>.mapper.ts
  repositories/<entity>.repository.ts
  schema.ts, client.ts, index.ts

packages/engine/src/
  verification/*.ts
  scheduling/*.ts

apps/worker/src/
  jobs/<name>.job.ts
  adapters/<source>/<name>.adapter.ts
  shared/*.ts, job-registry.ts, main.ts

tests/acceptance/acNN-<description>.test.ts
tests/support/*.ts                  acceptance harnesses (import apps only via @caa/<app>/testing)
tests/golden/*.test.ts              golden corpus runners (development set, holdout, isolation)
tests/golden/holdout/               frozen holdout cases; importable only from tests/golden/

packages/test-kit/src/golden/
  golden-case.schema.ts             the golden case format (Zod)
  cases/<rule-family>.cases.ts      development cases, one file per rule family
```

## File naming

- **kebab-case** for every file and folder: `plan-revision.model.ts`, `system-status-card.tsx`.
- **Role suffix** before the extension says what the file is. `scripts/check-conventions.mjs` enforces the suffix per folder:

| Suffix                                          | Contains                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.model.ts`                                     | Zod schema, inferred type, factory for one data object, and any shared invariants over it (§Shared invariants) |
| `.enum.ts`                                      | One `as const` enum object, its type, schema, and any shared invariants over its values (§Shared invariants)   |
| `.contract.ts`                                  | Endpoint definitions and request/response schemas for one API module                                           |
| `.routes.ts` / `.controller.ts` / `.service.ts` | One API module's layers                                                                                        |
| `.logic.ts`                                     | Pure functions for one API module: no I/O, clock, randomness, or logging (standard 05 §Logic)                  |
| `.table.ts` / `.mapper.ts` / `.repository.ts`   | One entity's persistence                                                                                       |
| `.api.ts`                                       | Frontend functions that call one API module                                                                    |
| `.action.ts`                                    | One Next.js server action (standard 06 §Server actions)                                                        |
| `.job.ts` / `.adapter.ts`                       | One background job / one source adapter                                                                        |
| `.plugin.ts`                                    | One Fastify plugin                                                                                             |
| `.schema.ts`                                    | Zod schema for a test-data format (for example golden cases)                                                   |
| `.cases.ts`                                     | Golden cases for one rule family                                                                               |
| `.test.ts(x)`                                   | Tests, colocated with the file under test                                                                      |

- React component files are kebab-case and export one PascalCase component: `plan-card.tsx` → `PlanCard`.
- Hooks: `use-plan-revisions.ts` → `usePlanRevisions`.
- **One primary export per file.** Supporting types for that export may sit beside it, and so may the shared invariants of a `.enum.ts` or `.model.ts`.
- **Barrels:** only `<package>/src/index.ts`. Other packages import only from the package root (`@caa/domain`), never deep paths.
- **Test entry points:** the one exception is a documented `./testing` subpath export (ADR-0009). It is a single file `src/testing.ts` (no nested `index.ts`), exported as `"./testing"` in the workspace's `package.json`, used only by tests, and never bundled into the production entry. It is allowed only in these workspaces:
  - `apps/api` (`@caa/api/testing`) and `apps/worker` (`@caa/worker/testing`): build the app with test dependencies.
  - `packages/db` (`@caa/db/testing`): write synthetic scenarios into the test database, because only `@caa/db` owns the tables and client.

  Any other package or app needs an amendment to this list. Anything else under `src/` stays private.

## Size

Files over 250 lines or functions over 60 lines fail lint. Split by responsibility, not arbitrarily: extract a helper, a sub-component, or a new module.
