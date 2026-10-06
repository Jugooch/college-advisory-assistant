# 05 · API design and the backend layers

## How a request flows

```
HTTP request
  → <module>.routes.ts       registers path + method from the contract, attaches auth, points at a controller
  → <module>.controller.ts   parses input with the contract schema, gets the actor from the session,
                             calls ONE service method, sends the result via sendData()
  → <module>.service.ts      business logic: authorization decisions, orchestration of repositories,
                             engine calls, and the assistant
  → <module>.logic.ts        optional: pure functions over values the service already loaded
  → @caa/db repositories     SQL only; return domain objects
  → @caa/engine              pure academic rules
```

Each layer only calls the one below it. ESLint blocks controllers from importing repositories, the engine, or logic; services from importing Fastify; routes from importing services or logic; and logic from importing anything with I/O.

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

| Situation                               | Status                        | Code                                                   |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Body/params fail validation             | 400                           | `INVALID_REQUEST`                                      |
| Not signed in / no access to the object | 401 / 404                     | `UNAUTHORIZED` / `NOT_FOUND` (don't reveal existence)  |
| Program or catalog not qualified        | 422                           | `OUT_OF_SCOPE`                                         |
| Source down / stale / semantic gap      | 503 / 409 / 422               | `SOURCE_UNAVAILABLE` / `STALE_SOURCE` / `SEMANTIC_GAP` |
| Optimistic concurrency failure          | 409                           | `REVISION_CONFLICT`                                    |
| Solver cap reached / proven infeasible  | 200 with `outcome` (ADR-0010) | `SEARCH_TIMEOUT` / `NO_FEASIBLE_PLAN`, never an error  |
| Anything else                           | 500                           | `INTERNAL_ERROR`                                       |

## Services

- Factory function `createXxxService(dependencies)` returning an object that implements an exported `XxxService` interface.
- Long-lived dependencies (repositories, other services, the clock, configuration) come in through the `dependencies` object. Only `container.ts` constructs them. Pure code, meaning `@caa/engine` and `.logic.ts` functions, is imported directly, because there's nothing to construct or replace.
- A `.service.ts` file exports its factory, its `XxxService` interface, and their supporting types. Nothing else. Another service imports only its types and reaches its behavior through the injected interface. A pure helper that two services need goes in a `.logic.ts` file.
- Methods take the authenticated actor (`actor: Actor`) as their first argument when the operation touches tenant data. `// SECURITY:` comments mark authorization decisions.
- Request-scoped values come in through a single **final** `context: RequestContext` parameter that the controller builds from the request. Today it carries the request logger (`context.logger`, Fastify's `request.log`, typed as the `Logger` port), so every log line has the request ID (standard 09). New request-scoped values are added to `RequestContext`, never as extra parameters. Services never import Fastify types and never log through a process-wide logger.

  ```ts
  getStudent(actor: Actor, studentId: StudentId, context: RequestContext): Promise<Student>
  ```

- Services return domain objects or throw a typed domain error; they never build HTTP responses.

## Logic

A `<module>.logic.ts` file holds pure functions that a service calls: orchestration of engine calls over already-loaded inputs, or a policy decision such as source freshness. It exists so that pure code has one named place instead of hiding in a service file (ADR-0008).

- **Pure:** the result depends only on the arguments. No I/O, no repositories, no logger, no request context, no Fastify, no container. It never reads the clock or randomness. The service reads the injected clock and passes the time in.
- **May import:** `@caa/engine`, `@caa/domain`, types from `@caa/db` and `@caa/api-contract`, `shared/domain-errors`, and other `.logic.ts` files.
- **Imported by** services only. Controllers and routes never import it.
- **One primary export**, named for what it decides (`verifyCourseSet`, `isSourceFresh`). Supporting types and constants may sit beside it. It returns values and may throw a typed domain error. The service decides what to log.
- **Tested** with literal inputs and expected values, no fakes needed. A module may consist of a `.logic.ts` file alone.
- It restates no academic rule. Rules stay in `@caa/engine`, and logic only composes engine entry points.

## Source freshness

A validated result is built only from sources that are fresh (planning/09 §Proposed freshness policies, ADR-0008). For the student record and the audit:

| Setting                      | Value                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ACADEMIC_SOURCE_MAX_AGE_MS` | **Required in production**, with no default. Outside production the default is `86400000` (24 hours) |
| Accepted range               | `0` to `604800000` (7 days), whole milliseconds. Startup refuses anything else                       |
| Future tolerance             | 5 minutes (`300000`), a fixed constant, not configurable                                             |
| Times checked                | The snapshot's `sourceEffectiveAt` and the audit's `studentRecordEffectiveAt`                        |
| Fresh when                   | `-300000 ≤ now − time ≤ maxAge`. Exactly at the maximum age is fresh; 1 ms past it is not            |
| Missing or unparseable time  | Not fresh                                                                                            |
| Not fresh                    | 409 `STALE_SOURCE` with a referral, before any engine call. Never a PASS or a `VALIDATED` aggregate  |

- The 24-hour default is planning/09's proposed age. Each deployment sets the production value from the institution's approved policy. A production value above 24 hours needs that approval on record (planning/04 §Change control).
- The future tolerance absorbs clock drift between the source system and the API. A time more than 5 minutes ahead is a source error, not fresh data.
- The service reads the injected clock. The comparison is a `.logic.ts` function, so every endpoint that returns validated results applies the same check.
- **Gated endpoints:** `POST /v1/students/:studentId/course-checks` and `GET /v1/students/:studentId/academic-summary` (ADR-0008 Amendment 1). The summary has no 200 historical variant, and every 200 from either endpoint is fresh. `POST /v1/students/:studentId/schedule-options` also gates the term's section snapshot by its `sourceEffectiveAt` (ADR-0010). A new endpoint that returns record-, audit-, or section-derived verdicts uses the same gate.

## Schedule solver budget

`POST /v1/students/:studentId/schedule-options` bounds its search by a counted work cap, never a clock (ADR-0010 §1):

| Setting                    | Value                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `SCHEDULE_SOLVER_WORK_CAP` | Read once at startup. Defaults to `3000000` in every environment, an engineering calibration |
| Accepted range             | `1` to `3000000`, whole numbers. Startup refuses anything else                               |
| Unit                       | One attempt to add one bundle to a partial schedule, counted before the hard-rule checks     |
| Cap reached with options   | 200 `OPTIONS_FOUND` with `searchComplete: false`. Never called the best options              |
| Cap reached with none      | 200 `SEARCH_TIMEOUT`. Never reported as infeasible, and never an error envelope              |
| Recorded                   | `pinnedInputs.solverWorkCap` in the response; `workUsed` and `workCap` in the service log    |

Raising the ceiling needs an ADR-0010 amendment with a new measurement.

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
