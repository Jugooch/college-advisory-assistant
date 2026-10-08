# ADR-0013: Plan drafts, their staleness, and advisor cases

- **Status:** Accepted 2026-10-07. The repo owner accepted all seven product defaults on #399, with no overrides. Amended 2026-10-07 (Amendment 1).
- **Date:** 2026-10-07
- **Deciders:** Tech lead; repo owner (product decisions 1–7 on #399)
- **Related:** FR-02, FR-11, FR-12, FR-14, FR-15, FR-17, NFR-01, NFR-04, NFR-05, AC14, AC15, AC16, new AC32–AC37, T07, planning ADR-02, ADR-06, ADR-08, planning/07 §Request lifecycle and §Consistency model, planning/09 §Canonical entities and §Logical app interfaces, planning/11 §Core screens, ADR-0008 Amendment 1, ADR-0010, ADR-0011, issues #399–#418

## Context

Sprint S5 finishes planning/14's first vertical slice: "Save a draft, make its source stale, and create an advisor case." The planning docs name the pieces but leave the architecture open:

- **Drafts.** planning/09 lists `PlanRevision` (owner, selected sections, constraints, dependency IDs, validation ID) and says to "never overwrite reviewed historical revision". `POST /v1/plans` takes a "validated result ID". No validation result is stored today: schedule options is served synchronously on pinned inputs (ADR-0010), and the request-and-poll pair that would store one is deferred "until plan drafts need a stored request" (planning/09 decision note, #209).
- **Layering.** The stored result has the shape of `ScheduleOptionsResponse`, which lives in `@caa/api-contract`. But `@caa/db` may depend only on `@caa/domain` (lint layer boundaries).
- **Staleness.** FR-11 asks to "mark dependencies stale before reuse when inputs change". planning/07 asks to revalidate "when freshness expires or a dependency changes" and to keep the historical result readable with its original timestamp. AC14 asks that a source outage at reopen still show the historical plan while current validity is withheld. ADR-0008 Amendment 1 deferred any historical view until a server-derived marker exists.
- **Cases.** planning/09 lists `AdvisingCase` (student, owner, reason, minimal context, status, resolution) and `POST /v1/cases` ("app-owned case; no external message sent"). FR-12 asks for ownership, status and an audit trail. FR-17 asks for discrepancy reports that never mutate authoritative records. planning/08 says a reviewer comment is never promoted into an official waiver.

## Decision

### 1. A plan per student per term, with append-only revisions

- A `Plan` is keyed by tenant, student and term. Each save or revalidation appends a `PlanRevision` numbered 1, 2, 3 …, with `cause` `SAVED` or `REVALIDATED`.
- Revisions are immutable. A database trigger refuses UPDATE and DELETE, as for published rules (migration 0003). Nothing is overwritten, reviewed or not.
- Appending uses the ADR-0011 pattern. The caller states `expectedRevision`, the repository inserts `expectedRevision + 1`, and the unique key `(plan_id, revision)` turns a race into 409 `REVISION_CONFLICT`.
- **Rejected alternative:** several named drafts per term. That adds naming, listing and comparison work with no slice requirement behind it (decision 2 on #399).

### 2. What a revision stores: the server's replay, never the client's evidence

A revision stores:

- the student's inputs: term, courses, credit selections, and constraints;
- every pinned input of ADR-0010 §7: student snapshot, audit source and version, ruleset version, section snapshot, campus transition version, solver work cap, and constraint hash;
- the outcome;
- the chosen section set, or `null` when the outcome has no options. A blocked, timed-out or needs-verification result can be saved so it can go to an advisor;
- the full schedule-options result.

**Save by replay.** The save request carries the inputs, the chosen section set, and the `pinnedInputs` the client was shown. The server runs schedule options again through the same service and freshness gate:

- Stale or missing sources are 409 `STALE_SOURCE` or 503 `SOURCE_UNAVAILABLE`, and nothing is written.
- Replay pinned inputs that differ from the client's are 409 `REVISION_CONFLICT`, and nothing is written. The client refreshes its options.
- A chosen section set that isn't one of the replayed options (or isn't `null` when there are none) is 400.

Because the engine is deterministic (NFR-01), the replay on equal pinned inputs is the result the student saw. This also gives planning/09's "validated result ID" without storing every schedule-options response, so request-and-poll stays deferred.

**Opaque storage, contract parse on read.** `@caa/db` stores the result as JSONB and returns it as opaque JSON. `@caa/db` never imports the contract. The api parses it with `ScheduleOptionsResponseSchema` on read. If a stored result no longer parses, for example after a later contract change, the response carries `result: null` and `resultUnavailable: true`. The UI says the saved result can't be displayed and offers revalidation or an advisor. A stored result is never repaired, guessed or partly shown.

**Rejected alternatives:**

- Storing inputs only and recomputing on open. This loses the historical view AC14 requires.
- Accepting the client's result. That trusts client-supplied academic evidence.
- Moving the response schemas into `@caa/domain`. That's a large refactor for no behavior gain.

### 3. Staleness is derived on the server at read time, never stored

Each plan or revision read returns `freshness: { state, reasons, checkedAt }`. A pure `plan-freshness.logic.ts` (ADR-0008) computes it from the revision's pinned inputs and the current latest IDs and times, which the service reads with the injected clock.

| State     | When                                                                                                                                                                      | Reasons                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CURRENT` | Every pinned input is still the latest for the student, tenant and term, and every pinned time is within `ACADEMIC_SOURCE_MAX_AGE_MS` (exactly at the age is still fresh) | none                                                                                                                                                   |
| `STALE`   | Any pinned input was superseded, or any pinned time is past the age                                                                                                       | one or more of `STUDENT_RECORD_SUPERSEDED`, `AUDIT_SUPERSEDED`, `SECTIONS_SUPERSEDED`, `RULESET_CHANGED`, `TRANSITION_TABLE_CHANGED`, `SOURCE_EXPIRED` |
| `UNKNOWN` | A current source can't be read, or two current records tie for latest                                                                                                     | `SOURCE_UNAVAILABLE`, plus any `STALE` reasons already proven                                                                                          |

- **Precedence:** proven reasons are always listed. `CURRENT` needs every comparison to succeed, so UNKNOWN is never shown as CURRENT.
- **The ruleset is compared** with whatever selects the active version today (`ACTIVE_RULESET_VERSION`, or the per-tenant activation log once #231–#236 land).
- **A stale or unknown revision is still returned in full, as history** with its original `createdAt` and states. Reading a draft never fails because a source is down or old (AC14, NFR-05, planning/07 §Failure containment). The contract and UI label every state in the revision "as of" its time. Nothing in a response presents a stored PASS as current.
- **A stored flag was rejected.** Staleness depends on later imports and on the clock, so a stored flag would need a write on every import and would still go wrong as time passes.
- **Relation to ADR-0008 Amendment 1.** This is the server-derived historical marker that amendment waited for, scoped to saved plan revisions. The live academic summary and course checks keep their 409 `STALE_SOURCE`.

### 4. Revalidation creates a new revision

`POST /v1/students/:studentId/plans/:planId/revalidate` with `{ expectedRevision }`:

- A stale `expectedRevision` is 409 `REVISION_CONFLICT`.
- The server replays the latest revision's stored inputs on the current pinned inputs, through the same freshness gate. If those sources are stale or missing, the request is 409 or 503 and nothing is written.
- It appends a `REVALIDATED` revision.
- The earlier selection carries over only if the identical section set is among the new options. Otherwise the selection is `null` and the student chooses again. The server never substitutes a different section.
- Nothing revalidates automatically. The student or the UI asks.

### 5. Access to drafts

- **Reads** use `canViewStudent`: the student, an advisor with an active assignment, or an admin, all within the session's tenant.
- **Saves and revalidations** are allowed only for the student's own record. A new access method makes the check. Anyone else, an assigned advisor included, gets 404, the deny response used for every not-permitted object operation. Advisors read a plan; they don't author it (decision 4).
- Tenant, user, owner and role come from the session. A body naming any of them is 400.

### 6. Advisor cases: an app-internal, append-only state machine

**Objects.** An `AdvisingCase` has:

- a `reason`: `PLAN_REVIEW`, `NEEDS_VERIFICATION`, or `SOURCE_DISCREPANCY`;
- a `planRevisionId`, required except for a discrepancy;
- a `discrepancySubject` for a discrepancy: `PROGRAM_OR_CATALOG`, `COURSE_ATTEMPT`, `AUDIT_REQUIREMENT`, or `SECTION`;
- a student note of 1–500 characters;
- `status` and `ownerUserId`.

Each change is a `CaseEvent` with `sequence`, `action`, the actor, the time, the from and to status, and, on `RESOLVE` only, a `resolution` and a note of up to 1,000 characters.

**States and transitions.** The transition table is an api workflow rule, not an engine result, so it is not a shared invariant (ADR-0005, standard 01 §Shared invariants). It lives in a pure `apps/api/src/modules/cases/cases.logic.ts` (ADR-0008), `nextCaseStatus(status, action, actor)`, which the cases service calls (built in #411, used by #412). The service derives `actor` from the session and the case: the student, the owner, or an assigned advisor or admin. The logic file holds the whole table below and refuses every other pair. `@caa/domain` holds only the `CaseStatus`, `CaseAction`, `CaseReason`, `DiscrepancySubject` and `CaseResolution` enums and the case and event models; no domain or contract schema checks a transition. Each case view carries `allowedActions` for the session's actor, computed by the same logic file, so the web never re-derives the table.

| From                | Action     | Actor                     | To                               |
| ------------------- | ---------- | ------------------------- | -------------------------------- |
| (none)              | `CREATE`   | the student               | `OPEN`                           |
| `OPEN`              | `CLAIM`    | assigned advisor or admin | `IN_REVIEW`, actor becomes owner |
| `IN_REVIEW`         | `RELEASE`  | the owner                 | `OPEN`, no owner                 |
| `IN_REVIEW`         | `RESOLVE`  | the owner                 | `RESOLVED`                       |
| `OPEN`, `IN_REVIEW` | `WITHDRAW` | the student               | `WITHDRAWN`                      |

- `RESOLVED` and `WITHDRAWN` are final. A new question opens a new case.
- At most one `OPEN` or `IN_REVIEW` case exists per plan, enforced by a partial unique index. A second one is 409 `REVISION_CONFLICT`.
- **Concurrency.** Each action states `expectedSequence`, and `(case_id, sequence)` is unique, so two advisors claiming at once get one 201 and one 409.

**Routing and the queue.** No queue table exists. An advisor's queue is the cases of students they hold an active `AdvisorAssignment` for at the request time, found by a join in SQL. Admins see the tenant's cases, including an "unrouted" view of open cases whose student has no active assignment, so the student always has a human route. Every case action rechecks access on that call, so a revoked assignment is 404 on the next action (AC15).

**Frozen context.** A case shows the referenced revision exactly as stored, with that revision's freshness at read time. It never shows a newer revision, and never the chat or anything the student didn't choose (planning/11 §Case submission). Case views show event actors as a role plus `isYou`, never another user's ID or name.

**What a resolution is.** A resolution code is `PLAN_REVIEWED`, `STUDENT_ACTION_NEEDED`, or `REFERRED_OUTSIDE_APP`, and its note is visible to the student.

- A resolution changes no plan revision, check, source row or exception.
- It is labeled "advice, not permission to enroll" (planning/11).
- A discrepancy case never alters the disputed record (FR-17). It can't become a waiver (planning/08 §Rule lifecycle).

**Nothing leaves the app.** No email, SMS, webhook or institutional write is made (FR-15, planning ADR-02 and ADR-08, decision 7). Case services take no such dependency, and a test asserts it. The student note is stored for the advisor and never logged or sent to a model. Log lines carry opaque IDs, the reason and the status (FR-14).

### 7. Endpoints

Paths are student-scoped, like every endpoint so far, in place of planning/09's `/v1/plans` and `/v1/cases`:

| Endpoint                                                        | Purpose                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST /v1/students/:studentId/plans`                            | Save by replay (§2)                                            |
| `GET /v1/students/:studentId/plans`                             | One row per term: latest revision, freshness, open case status |
| `GET /v1/students/:studentId/plans/:planId`                     | Latest revision, revision index, freshness                     |
| `GET /v1/students/:studentId/plans/:planId/revisions/:revision` | A historical revision and its freshness                        |
| `POST /v1/students/:studentId/plans/:planId/revalidate`         | §4                                                             |
| `POST /v1/students/:studentId/cases`                            | Create a case (the student only)                               |
| `GET /v1/students/:studentId/cases`                             | The student's cases                                            |
| `GET /v1/cases/:caseId`                                         | Case view with its events and frozen context                   |
| `GET /v1/advisor/cases`                                         | The advisor or admin queue                                     |
| `POST /v1/cases/:caseId/events`                                 | `CLAIM`, `RELEASE`, `RESOLVE`, `WITHDRAW`                      |

`GET /v1/cases/:caseId` and the events endpoint aren't student-scoped, because an advisor works from the queue. The service loads the case in the session's tenant and then checks `canViewStudent` for its student. A case the actor can't see is 404, identical to a missing one.

No new error code is needed: `REVISION_CONFLICT`, `STALE_SOURCE` and `SOURCE_UNAVAILABLE` already exist.

## Consequences

- The slice is demonstrable on synthetic data with no engine change. Determinism (NFR-01) makes replay-on-save sound.
- Contract changes to `ScheduleOptionsResponse` can make old stored results unparseable. They then show as "result unavailable", never as a guess. A contract PR that would break stored results says so, and offers a migration if drafts must survive it.
- Each plan read does a few "latest ID" lookups. That is acceptable at pilot scale (NFR-06); revisit if measured otherwise.
- planning/09 gets a decision note for the endpoints, and planning/13 gets AC32–AC37 (both in this PR). planning/07 needs no edit, because its rule already covers this: saved results stay readable with their original timestamp.
- The issues for this work, in merge order, are on #399. Tooling: no new file roles, so devops has nothing to add. The `.logic.ts` role and layer rules already cover `plan-freshness.logic.ts` and `cases.logic.ts`.
- Retention of plans and cases follows planning/09's placeholder (pilot plus 90 days) until an institution approves a schedule. Deletion is not built in S5.

## Revisit when

- An institution wants several named drafts per term, or plans beyond the next term.
- Advisors need internal notes, reassignment to a named advisor, SLAs or overdue states (planning/11 "overdue case").
- A notification channel is authorized (planning ADR-08). That is a new decision, not an extension of this one.
- Freshness reads become a measured latency problem. Then consider a precomputed dependency index, still derived and never trusted over a live comparison.
- A historical view of the academic summary is designed. It can reuse this marker (ADR-0008 Amendment 1).

## Amendment 1 (2026-10-07, issue #439): each case event records the role its actor acted as

**Related:** #411, PR #437, #412, #439, #444–#450. Section 6 (Objects, Frozen context). Standard 08 §Required-field ripple (staged rollout). FR-02, FR-12, FR-14.

**Context.** Section 6 shows event actors and the owner as a role plus `isYou`, but a `CaseEvent` stores only `actorUserId`. PR #437 infers the role at read time: the student's user is `STUDENT`, the viewer's own events show the viewer's staff role, and every other staff user shows as `ADVISOR`. So an admin's `CLAIM` reads as `ADVISOR` to the student and to other staff, and the same event can read differently to different viewers. Options:

- (a) keep inferring, and look up the actor's current roles at read time;
- (b) record the role on the event when it is written.

(a) reports today's roles, not the role used, and a user can hold both `ADVISOR` and `ADMIN`. **Option (b).** An event is append-only history, so the role it was taken in belongs on it.

**Decision.**

- **Field.** `CaseEvent.actorRole`, of the existing `Role` enum in `@caa/domain` (`STUDENT`, `ADVISOR`, `ADMIN`). No new enum. Column `case_event.actor_role`, text, with a check on those three values.
- **Set from the session at write time, never from the body.** The cases service sets it when it writes the event. The events request has no role field. The rule:
  - `CREATE` and `WITHDRAW`: `STUDENT`, since only the student may take them.
  - `CLAIM`, `RELEASE` and `RESOLVE`: `ADVISOR` when the session holds `ADVISOR` and an active `AdvisorAssignment` for the student at the request time. Otherwise `ADMIN`, the only other role that can reach the case.
- **Views read the stored role.** An event's `actorRole` is its stored `actorRole`, the same for every viewer. The owner's role is the `actorRole` of the case's latest `CLAIM` event. `isYou` is unchanged. The view still carries no user ID or name.
- **Backfill.** Existing rows get a role in the migration that adds the column: `CREATE` and `WITHDRAW` get `STUDENT`. Every other action gets `ADVISOR` when the actor's `user_identity.roles` contains `ADVISOR`, otherwise `ADMIN`. The migration lifts the append-only trigger only for this `UPDATE`, inside the same transaction. The rule uses roles because assignment history isn't kept per event. It can only differ for a dual-role user acting without an assignment.
- **Rows this affects.** There is no production data. The dev seed writes no cases, so the only rows are cases made by hand in a local database. The backfill covers those. Test databases are built fresh. Builders and harness fakes default the role by the same rule: `STUDENT` for the student's actions, `ADVISOR` for staff.

**Order.** Standard 08's staged rollout. Each step keeps `main` green, and nothing becomes required until every writer, builder and fake sets the field (the S4 lesson). The domain step comes first because a builder can only name a field the domain type has. It changes nothing else, since the field is optional.

1. Domain (#444): `actorRole: RoleSchema.optional()`, with `TODO(#449)`.
2. Data (#445), after #444: a migration that adds the nullable column and backfills it. Repository writes and reads carry the field, and a `NULL` maps to an omitted field.
3. QA (#446), after #445: builders set `actorRole`. The case repository fakes in `tests/support` store whatever the request carries.
4. API (#447), after #445 and #446: the service writes `actorRole` on every event by the rule above. The mapper prefers the stored role and falls back to the inference only when it is absent. #412 writes it on the events it adds, whichever of the two merges second.
5. Data (#448), after #447 and #412: a migration that reruns the backfill for any `NULL` row, then sets `NOT NULL`. The repository types make the field required.
6. Domain (#449), after #448: `actorRole` required, and the `TODO` is removed.
7. API (#450), after #449: the mapper drops `roleOf` and reads the stored role for events and the owner.

**Consequences.**

- An admin's actions read as `ADMIN` to everyone, and each event reads the same to every viewer.
- The contract doesn't change, because `CaseEventView.actorRole` and `owner.role` already exist.
- No new file role, so devops has nothing to add.

**Revisit when** a role is added to `Role`, or an action can be taken by someone other than the student, the owner, or an assigned advisor or admin.
