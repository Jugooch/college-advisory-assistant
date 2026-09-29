# Data model, integration contracts, and lifecycle

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Canonical entities

All institution-scoped entities carry `tenant_id`; composite uniqueness and foreign-key rules prevent cross-tenant references. Internal IDs are distinct from source-system IDs. Store source mappings explicitly rather than using names as identifiers.

| Entity | Essential fields | Relationship/invariant |
|---|---|---|
| Institution | ID, timezone, approved source registry, configuration version | Tenant boundary |
| UserIdentity | issuer, subject, tenant, roles, status | SSO identity never matched solely by email |
| AdvisorAssignment | advisor, student/cohort, effective dates, approver | Access expires when assignment ends |
| StudentSnapshot | source student ID, program/catalog, attempts, placements, holds, source times | Immutable input revision |
| ProgramCatalog | program ID, degree, catalog version, coverage status | Catalog-specific qualification |
| Course | stable ID, aliases, credits, equivalency group | Labels can change independently of identity |
| CourseAttempt | source attempt ID, course, term, grade scheme/value, status, credits | Repeats remain separate attempts |
| AuditSnapshot | student snapshot reference, audit source/version, generated time, requirement tree | Detect transcript/audit skew |
| RequirementResult | source requirement ID, state, allocated attempts, remaining quantity, provenance | Do not reconstruct allocation from prose |
| AcademicException | source ID, affected student/rule, authority, scope, effective dates | Imported approval only |
| Term/Section | dates, meetings, links, campus, modality, restrictions, seat snapshot time | Term and section IDs tenant-specific |
| RuleMapping | source reference, semantics, version, approval, supported cohort | Immutable published versions |
| PolicyDocument | source URL, content hash, effective interval, approved status, audience | Retrieval must filter applicability |
| PlanRevision | owner, selected sections, constraints, dependency IDs, validation ID | Never overwrite reviewed historical revision |
| Validation | per-check status/reason, evidence, engine version, timestamps | Immutable result for pinned inputs |
| AdvisingCase | student, owner, reason, minimal context, status, resolution | Assignment-scoped access |
| DecisionEvent | actor/service, action, object ID, time, result, correlation ID | Minimize raw content |

## Source authority matrix

| Field | Default authority | Conflict behavior |
|---|---|---|
| Official program, attempts, holds | SIS | Refresh or open discrepancy |
| Catalog applicability and allocated credits | Approved degree audit | Block affected personalized claim if contradictory |
| Sections and meeting patterns | Registrar schedule feed | Quarantine invalid/missing schedule |
| Eligibility rules | Registrar-approved configuration/source | UNKNOWN on unsupported semantics |
| Approved exceptions | Official exception/audit source | Never accept free-text claims as approval |
| Availability preferences | Student | Confirm and version changes |
| General procedural guidance | Approved institutional policy corpus | Show conflicts and refer to policy owner |

Authority must be signed off per institution; this is a proposed default, not a universal statement about campus systems.

## Adapter envelope

Each import batch has source ID, schema version, extraction time, source effective time, cursor/batch ID, checksum, record count, and operation type. Each row includes stable source ID, record version where supplied, and explicit null/unknown semantics. Full snapshots and deltas must be distinguished: missing from a delta is not deletion. Use tombstones or a completed full-snapshot reconciliation for removals.

Validate schema, source identity, referential integrity, grade/credit enums, dates, and expected cohort coverage. Publish the new batch atomically only after validation. Quarantine invalid rows or the batch according to dependency impact; do not expose half an audit. Record rejected count and notify the assigned operator.

Idempotency key: tenant + source + batch ID, with checksum mismatch treated as conflict. Ordered updates require source sequence/effective time rules. A late older batch must not replace newer truth. Reprocessing yields the same snapshot identities or a linked equivalent revision.

## Proposed freshness policies

These are initial operating proposals requiring institutional approval and feed verification.

| Source | Initial maximum age for applicable claims | Expiry behavior |
|---|---|---|
| Transcript/program/audit | 24 hours and mutually consistent | Historical view only; refresh before new validated recommendation |
| Published section structure | 24 hours | Suppress current scheduling validity until refreshed |
| Seat snapshot | 5 minutes if live endpoint exists | Show timestamp and omit available-seat claim after expiry |
| Registration holds/readiness | 15 minutes if source supports it | Readiness unknown; never inferred from old absence |
| Approved policy/catalog | Version and effective dates plus daily change check | Withdraw affected interpretation on discovered unresolved change |

_Decision note (2026-09-29, ADR-0008 Amendment 1, #114):_ For the prototype, "historical view only" for transcript, program and audit is met by refusing the live academic summary and course checks past the maximum age: 409 `STALE_SOURCE` with an advisor referral. Nothing past the age is shown as current. A labeled historical view of the summary waits for a server-derived marker and its UX (revisit before G1).

These ages are not guarantees of source correctness. Even a fresh seat count can change before registration. If feeds cannot meet them, remove the dependent capability or approve a revised claim policy explicitly.

## Logical app interfaces

| Endpoint | Input | Output and safeguards |
|---|---|---|
| GET /v1/me/academic-summary | Authenticated identity | Authorized snapshot and coverage status |
| POST /v1/planning/requests | Term, preferences, pinned record revision | Server-derived subject; request ID; bounded planning job |
| GET /v1/planning/requests/{id} | Authorized request ID | Pending/result/error; per-check evidence |
| POST /v1/plans | Validated result ID, selected candidate | App-only draft revision; idempotency key |
| POST /v1/plans/{id}/revalidate | Expected plan revision | New revision or revision conflict |
| POST /v1/cases | Plan/result ID, selected context, reason | App-owned case; no external message sent |
| GET /v1/advisor/students/{id} | Assigned advisor identity | Scoped record view or denied |
| POST /v1/admin/config-releases | Approved artifact ID and expected active version | Restricted role; activation event |

Error vocabulary: UNAUTHORIZED, OUT_OF_SCOPE, SOURCE_UNAVAILABLE, STALE_SOURCE, SEMANTIC_GAP, REVISION_CONFLICT, SEARCH_TIMEOUT, and NO_FEASIBLE_PLAN. Do not expose raw vendor responses or student identifiers in errors. Tenant and role are never accepted as trusted JSON payload fields.

## Retention and deletion proposal

Minimize imported fields. Do not ingest SSNs, medical detail, full financial-aid files, or immigration documents for V1. Proposed defaults for review: raw conversation 30 days; reproducibility snapshots and plan/case records for the agreed pilot plus 90 days; security access events 1 year; backups 35 days. These are placeholders pending institutional records schedules, legal holds, and contractual needs, not asserted legal requirements.

Deletion must cover primary stores, indexes, caches, exports, and model-provider storage where applicable. Backups expire under the approved schedule; restores must reapply deletion tombstones. Preserve only authorized audit evidence. Before real data, approve a data inventory, retention schedule, deletion procedure, and processing agreement.
