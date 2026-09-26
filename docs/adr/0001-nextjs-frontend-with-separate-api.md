# ADR-0001: Next.js frontend with a separate Fastify API and worker

- **Status:** Accepted for the synthetic prototype
- **Date:** 2026-09-25
- **Deciders:** Product owner, tech lead
- **Related:** planning ADR-04 (modular monolith + worker), NFR-05, NFR-07, FR-10

## Context

The planning docs call for a TypeScript web client and API, PostgreSQL, and a worker queue for imports, validation, and a solver with a 15-second budget. The product owner prefers Next.js. Next.js can serve API routes, but the backend must enforce tenant and assignment authorization in one place, expose a versioned `/v1` contract that the AI tool gateway also uses, and run long jobs outside request handlers.

## Decision

- `apps/web`: Next.js (App Router) for UI only. No database access and no route handlers.
- `apps/api`: Fastify, layered as routes → controllers → services → repositories.
- `apps/worker`: separate process for imports, validation, and the solver.
- Shared packages for domain objects, the HTTP contract, the engine, persistence, and the assistant.
- pnpm workspaces monorepo; Drizzle ORM on PostgreSQL; Zod for all runtime schemas.

## Consequences

- One authorization boundary and one API contract for the UI and the AI tools.
- Long-running work is isolated from web requests.
- Two deployable services instead of one; local dev runs both via `pnpm dev`.
- Engine and data layers can move to separate runtimes later without touching the UI.

## Revisit when

A measured need for a different solver runtime, or hosting constraints from the partner institution.
