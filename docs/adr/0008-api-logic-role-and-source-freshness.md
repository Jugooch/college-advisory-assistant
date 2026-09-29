# ADR-0008: Pure logic files in API modules, and source freshness defaults

- **Status:** Accepted; amended 2026-09-29 (Amendment 1: the academic summary)
- **Date:** 2026-09-28
- **Deciders:** Tech lead
- **Related:** NFR-01, planning/07 §Request lifecycle, planning/09 §Proposed freshness policies, standards 01, 05, issues #153, #114, #152, PR #138

## Context

PR #138 added two kinds of pure code to `apps/api`, and neither had a place in the standards:

- `verifyCourseSet` runs the engine checks on already-loaded inputs. It's a pure function, not a factory service. It lives in `course-verification.service.ts` with a NOTE calling it an exception, because `apps/api/src/modules/*` allows only routes, controller, service, and mapper files.
- `isSourceFresh`, `assertSourcesFresh`, and `logRecordUnavailable` are free functions exported from `pinned-records.service.ts`, and `course-checks.service.ts` imports them directly. The file is at the 250-line limit, has several primary exports, and the freshness gate can't be replaced in service tests.

The same PR added a freshness gate. `ACADEMIC_SOURCE_MAX_AGE_MS` defaults to 24 hours outside production and is required in production, and a fixed 5-minute tolerance applies to future times. Reviewers asked for a tech-lead decision, because planning/09 marks the ages as proposals that need institutional approval.

The options for pure code were:

1. **Wrap it as a service** (`createCourseVerificationService()`) and inject it. This adds ceremony for code with nothing to construct, and it hides the fact that it's pure.
2. **Bless the exception**, a `.service.ts` exporting a free function. Then "service" means two things, and the next consumer has to pick one.
3. **Add a `.logic.ts` role** for pure functions in a module.

## Decision

**Option 3.** `<module>.logic.ts` is a role in `apps/api/src/modules/<module>/` (standard 05 §Logic):

- **Pure:** no I/O, repositories, logger, request context, Fastify, container, clock, or randomness. The service reads the injected clock and passes the time in.
- **May import:** `@caa/engine`, `@caa/domain`, types from `@caa/db` and `@caa/api-contract`, `shared/domain-errors`, and other `.logic.ts` files.
- **Imported by** services only.
- **One primary export**, plus supporting types and constants. A module may consist of a `.logic.ts` file alone.
- **Service files export only** their factory, their interface, and supporting types. Another service imports only their types, and shared behavior goes through the injected interface.

Standard 05's services section also stops listing "engine functions" as injected dependencies. Engine and logic functions are pure and imported directly, which is what the code already does.

**Freshness defaults, confirmed as built in #138:**

- `ACADEMIC_SOURCE_MAX_AGE_MS` is required in production, with no default, because each institution approves its own value. Outside production it defaults to 24 hours, planning/09's proposed age. Accepted values are whole milliseconds from 0 to 7 days.
- The future tolerance is a fixed 5 minutes, for clock drift between the source and the API.
- The gate checks the snapshot's `sourceEffectiveAt` and the audit's `studentRecordEffectiveAt`. A missing or unparseable time is not fresh. When the gate fails, the API returns 409 `STALE_SOURCE` with a referral before the engine runs. Amendment 1 applies the same gate to the academic summary.

This doesn't change a planning doc. The 24-hour value is planning/09's own proposal. A production value above 24 hours needs recorded institutional approval under planning/04 §Change control.

### Where the #138 code goes

| Today                                                                                                | Moves to                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `course-verification/course-verification.service.ts` (`verifyCourseSet`)                             | `course-verification/course-verification.logic.ts`, with its test renamed to match. The NOTE about an exception is removed                                                                                                                                |
| `isSourceFresh`, `FreshnessPolicy`, `SOURCE_TIME_FUTURE_TOLERANCE_MS` in `pinned-records.service.ts` | New module `source-freshness/source-freshness.logic.ts`, with its own test                                                                                                                                                                                |
| `assertSourcesFresh`, `logRecordUnavailable` (free functions imported by `course-checks.service.ts`) | Methods on the injected `PinnedRecordsService`, for example `assertFresh(scope, records)` using the `now` and `maxSourceAgeMs` from its own dependencies, and `recordUnavailable(scope, reason)`. Course checks and #114 reach them through the interface |

## Consequences

- Pure code has one named place in the API, and a reader knows from the suffix that it has no side effects. Lint can hold it to the engine's determinism rules.
- Services lose the free-function exports, so the freshness gate becomes replaceable in service tests, and `pinned-records.service.ts` is left with one primary export and room under the size limit.
- #114 (summary expiry) reuses `isSourceFresh` and the pinned-records gate instead of copying them.
- The seeded dev scenarios go stale 24 hours after seeding. #152 (seed times relative to the seeding run) fixes that. The default isn't raised to hide it.
- Tooling: the devops-engineer adds `logic` to the API module roles in `scripts/lib/structure-rules.mjs`, a `*.logic.ts` import block in `config/eslint/layer-boundaries.mjs`, and bans `*.logic` from controllers and routes. Until then, review enforces this ADR.

## Revisit when

- A logic function needs a dependency to be replaceable in tests. That makes it a service.
- An institution approves freshness ages per source that differ, which would need one setting per source instead of one shared setting.
- Clock drift over 5 minutes is seen from a real source.

## Amendment 1 (2026-09-29): the academic summary uses the same gate

**Related:** #114, #178, #202, PR #199.

**Context.** The freshness decision above named course checks only. #114 extends the gate to `GET /v1/students/:studentId/academic-summary`, and two architecture reviews disagreed on whether this ADR covered that. Three planning texts bear on it:

- planning/07 §Failure containment: "source outages should not crash read-only historical views".
- planning/09 §Proposed freshness policies: past the maximum age, transcript, program and audit data is "historical view only; refresh before new validated recommendation".
- planning/07 §Request lifecycle and AC14: a saved plan revision stays readable with its original timestamp and status.

**Options.**

1. **409 `STALE_SOURCE` with an advisor referral**, the same as course checks.
2. **200 with a server-derived historical marker.** The UI would show it as a historical view that needs a refresh.

**Decision: option 1, for the prototype.** Past `ACADEMIC_SOURCE_MAX_AGE_MS` the academic summary returns 409 `STALE_SOURCE` with an advisor referral. It is refused before any result is built, by the same `PinnedRecordsService.assertFresh` gate, with the same missing-time and future-tolerance rules. Every 200 from either endpoint is fresh by definition, so the contract carries no freshness marker. Reasons:

- **The summary isn't an audited historical artifact.** It's a live read of the current sources, and it carries PASS verdicts (`auditReflectsRecord`, `programCatalogConsistency`). Past the maximum age, those verdicts would read as current standing. planning/09 allows a historical view only if it is presented as history, and nothing in the contract or UI can say so yet.
- **One gate for both endpoints** is the conservative choice. UNKNOWN is never shown as PASS, and a referral is the planning/09 expiry path ("refresh before new validated recommendation").
- **planning/07's "historical views" are saved results with their original timestamp,** such as plan revisions (AC14), and a source outage must not break them. This decision doesn't touch them. The request is refused because its sources are too old; nothing crashes.

**Consequences.** planning/07 and planning/09 get a note pointing here. Standard 05 §Source freshness names both endpoints. The planning/13 AC28 row and README scenario 4 describe the 409. The #114 api and qa PRs cite this amendment.

**Revisit when** a historical-view UX is designed: a server-derived marker in the contract and a UI that shows it as history needing a refresh. At the latest, revisit before G1. Option 2 then replaces the 409 for the summary only.
