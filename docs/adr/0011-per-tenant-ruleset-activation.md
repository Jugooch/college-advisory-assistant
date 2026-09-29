# ADR-0011: Per-tenant ruleset activation

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Tech lead
- **Related:** FR-13, FR-06, FR-14, NFR-01, planning/08 §Rule lifecycle, planning/09 §Logical app interfaces, planning/17 §Academic change process, planning/04 §Accountability matrix, ADR-0010, issues #139, #100, #231, #232, #233, #235, #236, PR #138, #227

## Context

Course checks choose the ruleset from one API-wide setting, `ACTIVE_RULESET_VERSION` (PR #138). If it's missing, the request fails with 500 `INTERNAL_ERROR`. That doesn't fit the planning docs:

- Rulesets are per tenant. `academic_policy` and `prerequisite_rule` are keyed by tenant and `ruleset_version`, and published rows are immutable (#227). One process-wide version can't serve two institutions.
- planning/09 lists `POST /v1/admin/config-releases`. It takes an approved artifact ID and the expected active version, needs a restricted role, and records an activation event.
- FR-13 requires rollback of rule releases. planning/08 §Rule lifecycle records a rollback version for each published ruleset.
- Changing the setting means a redeploy, and it leaves no record of who changed the version, when, or from what.

Schedule options (ADR-0010) will pin the ruleset in the same way, so both endpoints need one answer.

## Decision

### The activation object

A `RulesetActivation` records that a tenant made one published ruleset version active. It's a domain model with a branded `RulesetActivationId`:

| Field                    | Meaning                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `tenantId`               | The institution. It comes from the session, never from the body                                                           |
| `sequence`               | 1 for the tenant's first activation, then one more than the previous one                                                  |
| `rulesetVersion`         | The version made active. It must have an `academic_policy` row for the same tenant                                        |
| `previousRulesetVersion` | The version it replaced. It's `null` exactly when `sequence` is 1, and it never equals `rulesetVersion`                   |
| `activatedBy`            | The user ID of the actor who activated it, from the session                                                               |
| `activatedAt`            | ISO 8601 with offset, from the API's injected clock                                                                       |
| `changeReference`        | 1–200 characters pointing to the approval record kept outside the app (planning/04), such as a ticket ID. No student data |

### One active version per tenant, derived, not stored

Activations are an append-only log. The active version for a tenant is the `rulesetVersion` of its activation with the highest `sequence`. There's no mutable "active" flag, so two active versions can't exist. A tenant with no activation has no active ruleset.

### Optimistic concurrency

The request carries `expectedActiveRulesetVersion`, which is `null` when the caller expects none to be active. That is planning/09's "expected active version".

1. The service reads the tenant's latest activation. If its version (or `null`) differs from the expected one, it returns 409 `REVISION_CONFLICT` and writes nothing.
2. It inserts the new row with `sequence` one more than the one it read. The table is unique on `(tenant_id, sequence)`. If two releases race from the same head, one insert fails the constraint, and that request gets 409 `REVISION_CONFLICT`.

Other refusals, all with nothing written:

- a version with no `academic_policy` row for the tenant: 400 `INVALID_REQUEST`, with no hint whether another tenant has it;
- activating the version that's already active: 400 `INVALID_REQUEST`, because an activation must change something.

A retry after a lost response gets 409, because the active version has moved. The caller reads the log and sees that its release landed.

### Rollback (FR-13)

Rollback is a new activation of an earlier version, for example `demo-2026.2` → `demo-2026.1` with `sequence` 3. Nothing is updated or deleted. Any version with published policy for the tenant can be activated, earlier or later. The log shows the whole history, including rollbacks.

### Role: `CONFIG_RELEASER`

planning/09 asks for a restricted role. A new `Role` value, `CONFIG_RELEASER`, is the only one that can read or write config releases. `ADMIN` alone can't. Separating the two follows planning/04: account administration and academic release are different duties.

- The role grants no access to student records. The access service keeps granting only on `ADMIN`, own record, or an active assignment.
- An actor without it gets 404 `NOT_FOUND` from both endpoints, the same as an unknown path. Standard 05 has no 403, and this doesn't reveal that the endpoint exists.
- **Deferred:** checking that the activator isn't the ruleset's author. Rulesets don't record an author or approver yet. Until they do, `changeReference` points to the external approval.

### Endpoints

Both are under `/v1/admin/config-releases` (planning/09). The request never carries a tenant, user or role.

| Endpoint                         | Body or query                                                                  | Success                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `POST /v1/admin/config-releases` | `rulesetVersion`, `expectedActiveRulesetVersion` (nullable), `changeReference` | 201 with the new `RulesetActivation`                                                   |
| `GET /v1/admin/config-releases`  | none                                                                           | 200 with `activeRulesetVersion` (nullable) and the 20 latest activations, newest first |

The activation row is planning/09's activation event. The service also logs it at info level, with the tenant, both versions, the sequence and the actor ID, and nothing else (FR-14).

### Pinning at request time

Course checks and schedule options read the tenant's active version **once**, at the start of the request, with `RulesetActivationRepository.findActive(tenantId)`. They then load the policy and rules for that version and pin it in `pinnedInputs.rulesetVersion`, as they do today. An activation that lands mid-request doesn't change the result in flight. The next request uses the new version.

A tenant with no activation gets 503 `SOURCE_UNAVAILABLE` with a referral, the same as a missing policy today. No version is ever guessed or defaulted. There is no cache, so an activation or rollback applies to the next request.

### Persistence

- **Table:** `ruleset_activation`, following the S1 tenant pattern: composite keys and cross-tenant foreign-key protection.
- **Foreign keys:** `(tenant_id, ruleset_version)` references `academic_policy (tenant_id, ruleset_version)`, so only a published version of the same tenant can be activated. `(tenant_id, activated_by)` references the tenant's user identities.
- **Constraints:** unique `(tenant_id, sequence)`. A check that `previous_ruleset_version` is null exactly when `sequence = 1`, and differs from `ruleset_version` otherwise.
- **Append-only:** UPDATE, DELETE and TRUNCATE are rejected by a trigger, as #227 does for published rules and policy.
- **Repository:** `findActive(tenantId)`, `listRecent(tenantId, limit)`, and `append(tenantId, draft)`. `append` reports a sequence conflict as a typed result, not a raw database error.
- **Seed:** one activation per seeded tenant, at `sequence` 1 with the seeded version, so local course checks keep working, and one `CONFIG_RELEASER` identity per tenant.

### Replacing `ACTIVE_RULESET_VERSION`

The setting stays until the api issue replaces it. That PR removes the setting from `env.ts`, the container and `RulesetNotConfiguredError`, and hands off the `infra/env.example` line to the devops-engineer.

### Follow-up issues, in dependency order

1. #231 (domain-engineer): the model and the role.
2. #232 (domain-engineer): the contract for the two endpoints.
3. #233 (data-engineer): the table, trigger, repository and seed.
4. #235 (api-engineer): the endpoints, request-time pinning, and removing the setting.
5. #236 (qa-engineer): the acceptance case, written in parallel.

### Deferred

- Per-cohort or per-program rulesets. The prototype qualifies one catalog cohort per tenant.
- Scheduled activation at a future effective time. Activation takes effect immediately.
- Cohort disablement flags (FR-13's other half) and adapter releases under the same endpoint.
- Marking saved plans for revalidation on activation (planning/17). Nothing saves plans until FR-11.
- An admin UI. The endpoints are enough for the prototype and for tests.

## Consequences

- Each institution runs its own ruleset version, and changing it needs no redeploy. Every change has an actor, a time, the version it replaced and an approval reference.
- Rollback is the same operation as release, so it gets the same tests and the same concurrency guard.
- A missing ruleset becomes a tenant data state (503 with a referral) instead of a server misconfiguration (500).
- Course checks gain one read per request. Replay is unchanged, because results already pin `rulesetVersion`.
- The new role is additive: existing actors, builders and identity rows stay valid, and nothing becomes required. The seed adds one `CONFIG_RELEASER` identity per tenant, and no seeded student, advisor or admin gets it.

## Revisit when

- A second catalog cohort or program is qualified for a tenant and needs a different ruleset (per-cohort activation).
- Rulesets record an author and an approver. Then the release check can refuse an activator who authored the version.
- Plan drafts (FR-11) exist. Then an activation must mark affected saved plans for revalidation.
- An institution needs activation at a future effective date, or adapter releases under the same endpoint.
