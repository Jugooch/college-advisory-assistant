# 01 · Repository structure and file naming

## Separation of concerns

The codebase is layered like MVC, with each concern in its own place.

| Concern                                         | Lives in                                                        | Never contains                                  |
| ----------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| **Pages** (routes and screens)                  | `apps/web/src/app/**/page.tsx`                                  | Business rules, `fetch`, data transformation    |
| **UI components**                               | `apps/web/src/features/*/components`, `apps/web/src/components` | API calls (receive data via props or hooks)     |
| **Frontend API calls**                          | `apps/web/src/api/*.api.ts`                                     | UI code                                         |
| **HTTP contract** (endpoints, DTOs, client)     | `packages/api-contract`                                         | Business logic                                  |
| **Routes** (path → controller)                  | `apps/api/src/modules/*/*.routes.ts`                            | Logic of any kind                               |
| **Controllers** (HTTP ↔ service translation)    | `apps/api/src/modules/*/*.controller.ts`                        | SQL, repositories, engine calls, business rules |
| **Services** (business logic, orchestration)    | `apps/api/src/modules/*/*.service.ts`                           | HTTP types, SQL                                 |
| **Data objects** (models, enums)                | `packages/domain`                                               | I/O of any kind                                 |
| **Academic rules**                              | `packages/engine`                                               | I/O, clocks, randomness                         |
| **Persistence** (tables, mappers, repositories) | `packages/db`                                                   | Business rules, HTTP                            |
| **Background jobs and source adapters**         | `apps/worker`                                                   | HTTP, UI                                        |
| **AI tools, prompts, templates**                | `packages/assistant`                                            | Direct database access                          |

Dependencies point one way:

```
web ──► api-contract ──► domain
api ──► api-contract, engine, db, assistant ──► domain
worker ──► engine, db ──► domain
```

ESLint `no-restricted-imports` blocks every other direction. `packages/domain` depends on nothing but `zod`.

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
    <module>.service.test.ts

apps/web/src/
  app/**/page.tsx|layout.tsx|...   Next.js reserved files only; no route.ts handlers
  api/<module>.api.ts               every call to the backend
  features/<feature>/components/*.tsx
  features/<feature>/hooks/use-*.ts
  features/<feature>/utils/*.ts
  components/ui/*.tsx               shared, presentational, feature-agnostic
  lib/*.ts                          app-wide singletons (API client)

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

| Suffix                                          | Contains                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `.model.ts`                                     | Zod schema, inferred type, factory for one data object               |
| `.enum.ts`                                      | One `as const` enum object, its type, and schema                     |
| `.contract.ts`                                  | Endpoint definitions and request/response schemas for one API module |
| `.routes.ts` / `.controller.ts` / `.service.ts` | One API module's layers                                              |
| `.table.ts` / `.mapper.ts` / `.repository.ts`   | One entity's persistence                                             |
| `.api.ts`                                       | Frontend functions that call one API module                          |
| `.job.ts` / `.adapter.ts`                       | One background job / one source adapter                              |
| `.plugin.ts`                                    | One Fastify plugin                                                   |
| `.schema.ts`                                    | Zod schema for a test-data format (for example golden cases)         |
| `.cases.ts`                                     | Golden cases for one rule family                                     |
| `.test.ts(x)`                                   | Tests, colocated with the file under test                            |

- React component files are kebab-case and export one PascalCase component: `plan-card.tsx` → `PlanCard`.
- Hooks: `use-plan-revisions.ts` → `usePlanRevisions`.
- **One primary export per file.** Supporting types for that export may sit beside it.
- **Barrels:** only `<package>/src/index.ts`. Other packages import only from the package root (`@caa/domain`), never deep paths.
- **Test entry points:** the one exception is a documented `./testing` subpath export. It is a single file `apps/<app>/src/testing.ts` (no nested `index.ts`), exported as `"./testing"` in the app's `package.json`, used only by tests (`@caa/api/testing`, `@caa/worker/testing`), and never bundled into the production entry. Anything else under `src/` stays private.

## Size

Files over 250 lines or functions over 60 lines fail lint. Split by responsibility, not arbitrarily: extract a helper, a sub-component, or a new module.
