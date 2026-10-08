# 02 · TypeScript style

Formatting is Prettier's job (`.prettierrc.json`); don't hand-format. This file covers what Prettier can't.

## Compiler

`tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Never weaken them per package.

## Naming

| Thing                            | Style                                       | Example                               |
| -------------------------------- | ------------------------------------------- | ------------------------------------- |
| Variables, functions, parameters | camelCase                                   | `planRevision`, `createHealthService` |
| Booleans                         | camelCase with `is/has/can/should/was/will` | `isStale`, `hasPrerequisite`          |
| Types, interfaces                | PascalCase, no `I` prefix                   | `PlanRevision`, `HealthService`       |
| Zod schemas                      | PascalCase + `Schema`                       | `PlanRevisionSchema`                  |
| Enum-like constants              | PascalCase object, PascalCase keys          | `CheckState.Pass`                     |
| Module-level constants           | UPPER_SNAKE_CASE                            | `TOOL_NAMES`, `MAX_CREDITS`           |
| React components                 | PascalCase                                  | `PlanCard`                            |
| Factories                        | `create<Thing>`                             | `createPlanRevision`                  |
| Mappers                          | `to<Target>`                                | `toInstitution`                       |
| Type guards                      | `is<Thing>`                                 | `isCheckResult`                       |

Use full words. `revision`, not `rev`; `request`, not `req` (except Fastify's parameter conventions inside controllers).

## Language rules

- **Named exports only.** Default exports are allowed only where a framework requires them (Next.js pages/layouts, tool config files).
- **No TypeScript `enum`.** Use an `as const` object with a matching type and `z.enum` schema (see 04).
- **`interface` for object shapes**, `type` for unions, mapped types, and Zod inference.
- **`import type`** for type-only imports (lint-enforced).
- **No `any`, no non-null assertions (`!`), no `as` casts** except when narrowing `unknown` right after a runtime check. Parse unknown data with Zod instead.
- **Explicit return types** on exported functions.
- **`readonly`** on interface fields and array parameters unless mutation is the point.
- **Prefer functions and closures over classes.** Services, controllers, and repositories are factory functions returning an object that matches an interface. Classes are reserved for errors (`extends Error`).
- **Options object** when a function needs more than 3 parameters.
- **`===` always.** No `==`.
- **async/await** over `.then` chains, except for one-line `.catch(() => fallback)`.

## Imports

Order (enforced and auto-fixed by `simple-import-sort`; run `pnpm lint --fix`):

1. Node built-ins (`node:fs`)
2. External packages (`zod`, `fastify`)
3. Workspace packages (`@caa/domain`)
4. App aliases (`@/api/...` in web)
5. Relative imports (`./health.service`)

One blank line between groups.

## Dependency injection

Anything with side effects (database, clock, network, logger, randomness) is passed in, never imported as a module-level singleton. Only the API composition root (`container.ts` and `wiring/*.wiring.ts`, standard 01 §Composition root) and `main.ts` (worker) construct real implementations. This keeps services testable without mocks of modules.

- **Long-lived** dependencies (repositories, clock, configuration) are passed once, through the factory's `dependencies` object.
- **Request-scoped** values (the request logger, and later correlation data) are passed per call, through a final `context: RequestContext` parameter built by the controller. See standard 05 §Services.
