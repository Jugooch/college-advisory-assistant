# 05 · API design and the backend layers

## How a request flows

```
HTTP request
  → <module>.routes.ts       registers path + method from the contract, attaches auth, points at a controller
  → <module>.controller.ts   parses input with the contract schema, gets the actor from the session,
                             calls ONE service method, sends the result via sendData()
  → <module>.service.ts      business logic: authorization decisions, orchestration of repositories,
                             engine calls, and the assistant
  → @caa/db repositories     SQL only; return domain objects
  → @caa/engine              pure academic rules
```

Each layer only calls the one below it. ESLint blocks controllers from importing repositories or the engine, services from importing Fastify, and routes from importing services.

## Contract first

Every endpoint is declared in `packages/api-contract/src/contracts/<module>.contract.ts` **before** the server or client code:

```ts
/** Response body for `GET /v1/plans/:planId`. */
export const PlanResponseSchema = z.object({ ... });

/** Reads one saved plan revision owned by the current student. */
export const getPlanEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/plans/:planId',
  response: PlanResponseSchema,
});
```

The server registers `getPlanEndpoint.path`, and the web client calls `apiClient.call(getPlanEndpoint)`. Neither side writes the path string by hand. A contract change is its own PR (domain-engineer) that lands before the server and client PRs.

## URL and method conventions

- Everything under `/v1`. Breaking changes need a new version.
- Plural, kebab-case resource nouns: `/v1/planning-requests`, `/v1/plans/:planId/revalidate`.
- `GET` reads, `POST` creates or triggers an action, `PATCH` partial update, `DELETE` removes. No verbs in paths except explicit actions (`/revalidate`).
- Path params are camelCase: `:planId`.
- JSON bodies use camelCase fields.

## Response envelope

Every response is one of two shapes:

```json
{ "data": { ... } }
{ "error": { "code": "STALE_SOURCE", "message": "Your record is being refreshed.", "requestId": "req-abc" } }
```

- `code` is from `ErrorCode` in `@caa/domain`. Add new codes there, never inline strings.
- `message` is safe to show a student: no stack traces, SQL, vendor payloads, or student identifiers.
- Controllers send success through `sendData(reply, ResponseSchema, data)`, which validates the payload against the contract before sending.

| Situation                                  | Status                        | Code                                                   |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------ |
| Body/params fail validation                | 400                           | `INVALID_REQUEST`                                      |
| Not signed in / no access to the object    | 401 / 404                     | `UNAUTHORIZED` / `NOT_FOUND` (don't reveal existence)  |
| Program or catalog not qualified           | 422                           | `OUT_OF_SCOPE`                                         |
| Source down / stale / semantic gap         | 503 / 409 / 422               | `SOURCE_UNAVAILABLE` / `STALE_SOURCE` / `SEMANTIC_GAP` |
| Optimistic concurrency failure             | 409                           | `REVISION_CONFLICT`                                    |
| Solver budget exceeded / proven infeasible | 200 with result state, or 422 | `SEARCH_TIMEOUT` / `NO_FEASIBLE_PLAN`                  |
| Anything else                              | 500                           | `INTERNAL_ERROR`                                       |

## Services

- Factory function `createXxxService(dependencies)` returning an object that implements an exported `XxxService` interface.
- Dependencies (repositories, engine functions, clock, logger) come in through the `dependencies` object. Only `container.ts` constructs them.
- Methods take the authenticated actor (`actor: Actor`) as their first argument when the operation touches tenant data. `// SECURITY:` comments mark authorization decisions.
- Services return domain objects or throw a typed domain error; they never build HTTP responses.

## Controllers

- Factory function `createXxxController(service)` returning an object whose handlers are **arrow-function properties** (so they can be passed to routes unbound).
- One handler per endpoint, named after the endpoint without `Endpoint`: `getPlan`, `createPlanningRequest`.
- Handlers stay under ~15 lines: parse, call, map, send.

## Repositories

- `createXxxRepository(db)` returning an `XxxRepository` interface.
- Every method on a tenant-scoped table takes `tenantId` first and filters by it. There is no method that reads across tenants.
- Return domain objects through mappers; never return rows.
- Institutional source data is read-only: repositories for imported snapshots expose no update methods.

## Frontend API calls

- Only `apps/web/src/api/<module>.api.ts` calls the backend, always through the shared `apiClient` (`src/lib/api-client.ts`).
- One exported function per endpoint, named for the action: `getHealth`, `createPlanningRequest`.
- Functions return contract types and let `ApiError` propagate. Pages and hooks decide how to present errors.
- `fetch` is banned everywhere else in the web app (lint-enforced).
