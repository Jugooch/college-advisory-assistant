# 09 · Errors, logging, and security

## Errors

- Throw typed errors (`class XxxError extends Error`) from services; the API error handler maps them to the envelope in `05-api-design.md`.
- Never swallow an error. A `catch` must rethrow, convert to a typed error, or return an explicit fallback that the caller's type makes visible (`T | null`).
- Parsing external input (HTTP bodies, source feeds, model output) always uses Zod `safeParse` or `parse`. Never cast.
- Retry only transient read errors, with bounded backoff. Authentication failures, semantic mismatches, and missing permissions are not retryable (`docs/planning/07`).

## Logging

- `console.*` is banned (lint). Use the Fastify request logger in the API and `pino` in the worker.
- Log structured objects: `logger.info({ planId, durationMs }, 'plan validated')`. The message is a short, lower-case, constant string; variables go in the object.
- **Never log**: student names, emails, grades, transcripts, conversation text, tokens, secrets, or full request bodies. Log opaque IDs only.
- Every log line in a request carries the request ID (Fastify does this automatically).

## Security rules

- **Identity**: tenant ID, user ID, and role come from the verified session on the server. They are never accepted from request bodies, query strings, or model tool arguments.
- **Authorization**: every read or write of a student-scoped object checks role, tenant, and assignment in the service layer, with a `// SECURITY:` comment. Deny by default.
- **Not found vs forbidden**: return `NOT_FOUND` for objects the actor may not see, so existence isn't revealed.
- **Read-only institutions**: no code writes to institutional systems. Adapter credentials are read-only.
- **Secrets**: only in environment variables loaded by `config/env.ts`. Never in code, fixtures, logs, or `infra/env.example`.
- **Model calls** (`packages/assistant`): send the minimum fields needed; treat model output and retrieved documents as untrusted data; tools are limited to the catalog in `tool-catalog.ts`.
- **Caches and queues**: keys and payloads always include the tenant ID.
- **Dependencies**: add a dependency only with a reason in the PR description; prefer the platform and existing packages.
