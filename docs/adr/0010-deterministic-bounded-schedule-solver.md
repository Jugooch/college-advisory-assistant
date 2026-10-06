# ADR-0010: Deterministic bounded schedule solver

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Repo owner (budget, course choice, travel time, sprint size), orchestrator (endpoint, outcome field, deferrals), tech lead
- **Related:** FR-07, FR-08, FR-18, NFR-01, NFR-07, AC06, AC07, AC08, AC12, planning/07 §Request lifecycle, planning/08 §Schedule model and §Constraint formulation, planning/09 §Logical app interfaces, ADR-0005, ADR-0008, issues #209, #210, #212, #213, #218, #219, #220, #221, #294

## Context

S4 builds the scheduling half of planning/14's first vertical slice. The solver has to be deterministic (NFR-01) and bounded (NFR-07), and the planning docs pull against each other:

- NFR-07 asks the solver to stop after a configured 15-second budget. A wall-clock cutoff stops at a different point on a loaded machine than on an idle one, so identical pinned inputs could give different options. That breaks NFR-01.
- planning/08 §Constraint formulation lets the solver choose courses by requirement progress. Doing that needs audit-backed candidate applicability for combinations, which S4 doesn't have.
- planning/09 lists an asynchronous `POST /v1/planning/requests` with a polled `GET`, but nothing in S4 stores a request or a plan draft (FR-11).
- Standard 05 allows a solver timeout or infeasibility as either a 200 or a 422.

The repo owner decided the budget, course choice, travel time and sprint size on #209. The orchestrator decided the endpoint, the outcome field and the deferrals, using the tech lead's proposed defaults. This ADR records those decisions in enough detail for #212, #213, #218, #219, #220 and #221 to build from.

## Decision

### 1. Budget: a fixed work cap, not a clock

Options: (a) a wall-clock cutoff, (b) a wall-clock guard in the API on top of a cap, (c) a counted work cap only. **Option (c).**

- **Unit of work:** one attempt to add one bundle to a partial schedule. The solver counts the attempt before it checks hard rules, so rejected attempts count too. Pre-search work isn't counted: building bundles (#219) and checking bundle pairs and single bundles against hard rules (#218). It is bounded by the input size, and it runs once per request.
- **Default:** `3_000_000` units. An exhaustive search of the worst S4 input, 8 courses with 6 bundles each, takes 6 + 6² + … + 6⁸ = 2,015,538 attempts, so the default finishes it with room to spare.
- **Stopping:** the search is complete when it runs out of attempts. If it needs an attempt beyond the cap, it stops and reports `searchComplete: false`. A search that needs exactly the cap is complete. The solver never uses more than the cap.
- **Where it's set:** the engine takes the cap as an argument and returns it, with the units used, in its result. The API reads it from `SCHEDULE_SOLVER_WORK_CAP` in `apps/api/src/config/env.ts`. It defaults to `3000000` in every environment, because it is an engineering calibration, not institutional policy. Accepted values are whole numbers from 1 to 3,000,000, and startup refuses anything else. Raising the ceiling needs an amendment to this ADR with a new measurement.
- **Recorded:** the response pins the cap in `pinnedInputs.solverWorkCap` (section 7).
- **Calibration:** the #220 PR measures the worst S4 input at the default cap on the CI runner and records the time. The target is 2 seconds or less. That is well under NFR-07's 15 seconds and leaves room under NFR-06's 10-second planning p95. A CI test asserts the units used (at most the cap) and never the elapsed time. If the measurement is over 2 seconds, the engine-engineer stops and hands back to the tech lead; the default isn't changed in the PR.
- **No wall-clock guard in the API.** A guard that returned a different outcome under load would break NFR-01 in the same way. The solver runs synchronously and can't be interrupted without a worker thread anyway. The service reads the injected clock around the solver call and logs `solverDurationMs`, `workUsed` and `workCap`, with no student data. A solve over 15 seconds is a calibration defect to fix, not a different answer.

### 2. Scope: the student picks the courses

The request names 1–8 courses, and all are required. The solver chooses exactly one bundle per course (a section plus its required linked sections, #219). Solver-chosen courses ("improve requirement progress", planning/08 §Constraint formulation, step 2) are **deferred**.

The academic course-set checks (prerequisite, applicability, allocation) don't depend on sections. The API runs them once through `verifyCourseSet` and attaches them to every option, and each option's aggregate follows the usual precedence. So a prerequisite FAIL makes every option BLOCKED. It doesn't change the outcome field, because the solver can't choose around a course the student requires.

### 3. Hard rules

A candidate is one bundle per requested course. Hard rules are never relaxed:

- no meeting conflict and no transition conflict between any two of its sections (#218);
- credit load within the policy bounds and the student's hard credit range (`checkCreditLoad`, counting only bundle members with `countsCredits`, #219);
- hard unavailable times, allowed modalities and allowed campuses (#212).

Each check gives PASS, FAIL or UNKNOWN. A FAIL removes the candidate. An UNKNOWN keeps it as an option whose schedule feasibility is UNKNOWN, and never PASS. A TBA meeting never satisfies a hard unavailable time (planning/08 §Schedule model).

### 4. Ranking and tie-break

Options are ordered by these keys, lexicographically, and the solver keeps the best 3. There's no weighted sum, so a student can inspect why one option ranks above another.

1. **Schedule feasibility:** PASS before UNKNOWN.
2. **Soft preferences, in the student's priority order** (rank 1 first; ranks are unique, #212). Each preference scores 0 if the option meets it and 1 if not. A preference that depends on a TBA meeting counts as not met. The vectors are compared element by element, and the smaller one ranks higher.
3. **Tie-break:** take all internal `SectionId`s in the option and sort them ascending by UTF-16 code unit (`<`, never `localeCompare`). Compare the two lists element by element; the first difference decides, and a proper prefix ranks first.

Nothing ranks by labels, section codes, instructors, or "easy courses".

Options are distinct: each differs from every other in at least one section. Two different candidates always differ, provided that #219 never returns two bundles with the same sections for one course.

**Search order.** Courses are searched fewest bundles first, then by course ID. Within a course, bundles are tried by their own ranking key (feasibility, then the preferences the bundle alone misses, then the tie-break). The order only affects which options a capped search finds. A complete search returns the top 3 by the ranking key, whatever the order. Shuffling the input gives a deep-equal result either way. The engine may prune a branch only when no completion of it could enter the top 3.

### 5. Outcomes: a 200 with an `outcome` field

Options: error envelopes (422 `NO_FEASIBLE_PLAN`, a 4xx or 5xx `SEARCH_TIMEOUT`), or **a 200 with a structured outcome.** We chose the 200. These are valid, verified answers about the student's request, and they carry evidence an error envelope can't.

| `outcome`            | `searchComplete`  | `options` | Evidence                       |
| -------------------- | ----------------- | --------- | ------------------------------ |
| `OPTIONS_FOUND`      | `true` or `false` | 1–3       | Each option's checks           |
| `NO_FEASIBLE_PLAN`   | `true`            | 0         | `conflictSet`                  |
| `SEARCH_TIMEOUT`     | `false`           | 0         | none                           |
| `NEEDS_VERIFICATION` | `false`           | 0         | `unresolved` (UNKNOWN results) |

- **`OPTIONS_FOUND`, complete:** the search finished and found candidates. The options are the best 3 by the ranking key.
- **`OPTIONS_FOUND`, incomplete:** the cap was reached after finding candidates. The UI says "search incomplete" and claims neither that the options are the best nor that no others exist.
- **`NO_FEASIBLE_PLAN`:** proven on known data. Either the search finished and every candidate broke a hard rule, or a requested course has no bundle because every one of its bundles failed.
- **`SEARCH_TIMEOUT`:** the cap was reached with no candidate (AC12). It's never reported as infeasible.
- **`NEEDS_VERIFICATION`:** a requested course has no bundle, and missing data is part of the reason. Either it has no sections in the snapshot (`SECTION_DATA_MISSING`), or at least one section was dropped because a required linked component has no permitted section (`LINKED_SECTION_UNAVAILABLE`). The search doesn't run.
- **Precedence before the search:** if any course has no bundle and all of its bundles failed, the outcome is `NO_FEASIBLE_PLAN`. Otherwise, if any course has no bundle because data is missing, it is `NEEDS_VERIFICATION`. This mirrors the aggregate precedence: FAIL, then UNKNOWN.
- **`conflictSet`:** the distinct FAIL results the solver's checks produced on the pinned inputs, deduplicated by reason code and sections. They're sorted by reason code, then by the tie-break key of their sections, and capped at 20 items with an `omittedCount`. Each item is a real engine result, so the set is verified. `isMinimal` is always `false` in S4, because minimality isn't checked (planning/08).
- **Limitations:** every response lists the fixed codes `SEAT_AVAILABILITY_NOT_CHECKED`, `REGISTRATION_READINESS_NOT_CHECKED` and `NOT_REGISTERED`. They are contract enum values, not free text.
- The existing `ErrorCode` values `SEARCH_TIMEOUT` and `NO_FEASIBLE_PLAN` stay for other uses. The schedule-options endpoint never sends them as an error envelope.

### 6. Endpoint: synchronous

`POST /v1/students/:studentId/schedule-options` answers synchronously on pinned inputs, bounded by the cap, like course checks. The body has `termId`, `courseIds` (1–8, unique), `creditSelections` and `constraints`, and never a tenant, user or role. Access follows course checks. planning/09's request-and-poll shape (`POST /v1/planning/requests`) is deferred until plan drafts (FR-11) need a stored request.

**Freshness:** the term's latest published section snapshot goes through the ADR-0008 gate (`PinnedRecordsService.assertFresh`) with the student snapshot and the audit, using `ACADEMIC_SOURCE_MAX_AGE_MS` (planning/09's 24 hours for published section structure).

| Case                                    | Response                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Snapshot past the maximum age           | 409 `STALE_SOURCE` with a referral, before any engine call                      |
| No published snapshot for the term      | 503 `SOURCE_UNAVAILABLE`                                                        |
| Two snapshots tie for latest            | 409 `STALE_SOURCE`                                                              |
| A requested course has no section in it | 200 `NEEDS_VERIFICATION`, `SECTION_DATA_MISSING` (settles #221's open question) |

Missing data inside a fresh snapshot is UNKNOWN in the engine, and never PASS. That covers a TBA meeting time, a linked group with no permitted partner, and a campus pair with no configured transition time.

### 7. Pinning

The response pins, in `pinnedInputs`, the course-checks fields (student snapshot, record and audit times, audit source and version, ruleset version) plus:

- `sectionSnapshotId`;
- `campusTransitionVersion`, the version of the tenant's transition table;
- `solverWorkCap`;
- `constraintHash`: `sha256:` and the lowercase hex SHA-256 of the canonical JSON of the normalized request. The request is normalized as `termId`, `courseIds` sorted, `creditSelections` sorted by course ID, hard constraints sorted by their canonical JSON, and preferences sorted by rank. The engine exports the pure normalizer. The API service computes the hash, because the engine may not use `crypto`.

The same pinned inputs and cap give a deep-equal response.

### 8. Travel time is in S4

Each tenant has a versioned campus transition table: the minutes needed from campus X to campus Y, for ordered pairs of different campuses. It has synthetic seed data (#215, #217). The same campus needs no transition. A meeting with no campus (online) isn't subject to one.

For two timed meetings on different campuses that share at least one active date and don't overlap:

- the gap is the later start minus the earlier end, in local wall-clock minutes;
- the required time is the table's entry from the earlier meeting's campus to the later one's;
- no entry for the pair gives UNKNOWN `TRANSITION_TIME_UNDEFINED`, whatever the gap, and never an assumed PASS;
- a gap under the required time gives FAIL `TRANSITION_TIME_INSUFFICIENT` (AC08);
- otherwise the pair passes.

The rule applies to every such pair in the option, not just consecutive meetings. That can be conservative when the table isn't metric, but it is never unsafe.

### 9. Deferred

- **Registrar section feed import** (the E02 worker). S4 persists and seeds section snapshots (#215, #217).
- **Seat availability and registration.** They're out of scope, and every response says so through the limitation codes above.
- **Solver-chosen courses** (requirement progress as a ranking key).
- **Request-and-poll planning requests** (planning/09), until FR-11.

### Change control (planning/04)

Interpreting NFR-07 this way is a planning deviation, so it's logged here and in a decision note in planning/06:

| Field                  | Record                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem                | NFR-07's wall-clock budget contradicts NFR-01 for identical pinned inputs                                                                    |
| Requirements affected  | NFR-07 (the budget is a calibrated work cap), NFR-01 (unchanged, now satisfiable), AC12 ("times out" means the cap was reached)              |
| Data classes, versions | None. No student data, adapter or rule version changes                                                                                       |
| Tests                  | #220 (the worst input within the cap, cap outcomes, shuffle determinism), #221 (a cap hit is the documented outcome, not a 500), #225 (AC12) |
| Migration and rollback | None to migrate. Rolling back to a clock would reintroduce the NFR-01 conflict, so it would need a new ADR                                   |
| Delivery impact        | None; the change is part of S4                                                                                                               |
| Approval               | Repo owner on #209, 2026-09-29, for the synthetic prototype. Institutional approval is still pending, as with every planning baseline        |

## Consequences

- The solver's result depends only on its inputs and the cap, so replay, golden cases and AC12 are exact and testable without timing.
- The cap is honest about its limit. A capped search says "search incomplete" or `SEARCH_TIMEOUT`, and never claims infeasibility or optimality it didn't prove.
- A request can block the API's event loop for up to the calibrated time (2 seconds or less). That's acceptable for the prototype's load, and it's the main reason to revisit.
- Contract (#212, #213): the outcome enum, `searchComplete`, `conflictSet` (`items`, `isMinimal`, `omittedCount`), `unresolved`, the limitation codes, and the pinned fields above. Invariants from the table become `.refine`s, for example `SEARCH_TIMEOUT` has no options and `NO_FEASIBLE_PLAN` has a `conflictSet`.
- Engine (#218, #219, #220): the transition rule, deduplicated bundles, the ranking key, the search order, and the counted cap, with a test that the worst S4 input finishes within the default cap.
- API (#221): `SCHEDULE_SOLVER_WORK_CAP` in `env.ts`, the freshness gate on the section snapshot, the constraint hash, and duration logging.
- Standard 01 gains §Determinism in pure code, and standard 05's error table and freshness list name this endpoint. The devops-engineer adds the matching lint (handoff on #209).

## Revisit when

- The #220 measurement, or a later one, puts the worst S4 input over 2 seconds, or planning p95 exceeds NFR-06's 10 seconds.
- Seeded or pilot section data regularly exceeds 8 courses × 6 bundles, so real requests hit the cap.
- Plan drafts (FR-11) need a stored planning request. Then move to request-and-poll, and run the solver off the API's event loop.
- Solver-chosen courses are scheduled. Requirement progress then becomes a ranking key between feasibility and preferences.
- A registrar feed or a seat source is qualified, which ends the deferral for the import or the seat claims.
- Students need a degree of violation for a preference (for example "two early classes is worse than one"), not just met or unmet.
- An institution's transition table needs consecutive-meeting semantics instead of every pair on a shared date.

## Amendment 1 (2026-09-29, issue #226): a TBA time conflicts only on a possible shared date

**Related:** #218, #226, PR #247, ruling GR-02 (planning/13 §Golden corpus design, Adjudication rulings).

**Context.** Section 6 makes a TBA meeting time UNKNOWN, and #218 says "a TBA meeting against any timed meeting on overlapping dates is UNKNOWN". Neither says what "overlapping dates" means when the TBA meeting's weekdays are known. Take a MW meeting with TBA times and a TTh 09:00–09:50 meeting over the same term. Their date intervals overlap, but they never meet on the same date. qa's scheduling golden planning (PR #247) couldn't write a case for it without a ruling.

**Decision.** For the meeting-conflict check between two meetings where either time is TBA:

- A meeting's possible dates are the dates from `startsOn` to `endsOn`, less its `excludedDates`, that fall on its weekdays. When its weekdays are TBA (`null`), every weekday counts.
- If the two sets of possible dates don't intersect, the pair is PASS. No meeting instance can overlap, whatever the times (planning/08 §Schedule model).
- If they share at least one possible date, the pair is UNKNOWN `MEETING_TIME_UNKNOWN`. It is never PASS, and never FAIL, because a TBA time can't prove a conflict.

"Overlapping dates" in #218 therefore means a shared possible date, not overlapping date intervals. Nothing else changes:

- A TBA time never satisfies a hard unavailable time (section 3).
- A preference that depends on a TBA meeting counts as not met (section 4).
- The transition rule applies only to two timed meetings (section 8).

This interprets planning/08; it doesn't deviate from it, so it needs no change-control record.

**Consequences.**

- Engine (#218): when either meeting's time is TBA, the conflict check compares possible dates first. It returns PASS on no shared date, and UNKNOWN `MEETING_TIME_UNKNOWN` otherwise. Its tests include a known-weekday TBA meeting against a timed meeting on other weekdays (PASS), and one sharing a weekday (UNKNOWN).
- QA (#226): a golden case for each of the two results, citing GR-02.

**Revisit when** a source publishes weekdays that can still change after publication. A known weekday would then no longer prove a disjoint date set.

## Amendment 2 (2026-09-29, issue #261): a TBA location decides travel as UNKNOWN

**Related:** #218, #261, PR #260. Amendment 1 (GR-02, PR #249) covers TBA times.

**Context.** Section 8 defines travel between two timed meetings on campuses. It doesn't cover a timed meeting whose location is TBA (`location: null`). Engine PR #260 returns UNKNOWN for that case and asked for confirmation.

**Decision.** This applies to two timed meetings that share a possible date and whose times don't overlap. An overlap is FAIL `MEETING_CONFLICT` whatever the locations, because the times alone prove it.

- If either meeting is online, no trip is needed and the pair passes the travel rule. An online meeting has no campus (section 8).
- Otherwise, if either location is TBA, the pair is UNKNOWN `MEETING_LOCATION_UNKNOWN`, whatever the gap. That includes two TBA locations. The TBA meeting may be on another campus, and it is never assumed to be on the same one.
- Otherwise, section 8 applies unchanged.

This follows planning/08's check-state table, where missing data is UNKNOWN, and section 8's rule that an unconfigured pair is UNKNOWN whatever the gap. It interprets section 8 and doesn't deviate from planning, so it needs no change-control record.

**Consequences.** Engine (#218, PR #260) returns this, with tests for a TBA location next to a campus meeting (UNKNOWN) and next to an online meeting (no trip). The domain adds `MEETING_LOCATION_UNKNOWN` in the second half of #212, and the web words it under the wording-map ripple (#261).

A meeting with a known campus and a TBA room (`room: null`) doesn't have a TBA location. Its campus decides travel as usual.

**Revisit when** pilot section data has TBA locations often enough that most options fall to UNKNOWN. The fix would then be better source data, or an institution-approved rule, never an assumed campus.

## Amendment 3 (2026-10-05, issue #220): the 2-second target is measured without coverage

**Related:** #220, PR #281 (calibration comment). Section 1, Calibration.

**Context.** Section 1 says to measure the worst S4 input on the CI runner against a 2-second target, but not in which run. CI's only test run is `pnpm test:coverage`. In it, the calibration test took 3,364 ms, sharing the runner with other test files. Locally the same test takes about 0.5 s plain and 1.73 s with coverage, so v8 instrumentation makes it about 3.4× slower. Production never runs instrumented code, so the instrumented time says nothing about NFR-06 or NFR-07.

**Decision.**

- The 2-second target applies to an uninstrumented run of the calibration test, `solve-schedule.calibration.test.ts`, on the CI runner. The cap (3,000,000) and the target (2 seconds) don't change.
- CI measures it in a dedicated step that runs only that file, without coverage, and fails when the test's reported duration is over 2,000 ms. The step's script reads Vitest's JSON report. It isn't a test, so no test reads the clock or the environment.
- The calibration test itself doesn't change. It asserts work units only, never elapsed time, as section 1 and standard 01 §Determinism already require. It runs unchanged in the coverage run, so it needs no mode detection or skip.
- An over-target result in the dedicated step is the "over 2 seconds" case of section 1: the engine-engineer stops and hands back to the tech lead.
- Order: the CI step merges first. PR #281 then merges `main`, and the step's result on that PR is the section 1 calibration, recorded in the PR. #281 doesn't merge before that number is recorded and is at most 2,000 ms.

This states how section 1's measurement is taken. It changes no requirement, cap or target, so it needs no change-control record.

**Consequences.**

- Devops (CI): a `Solver calibration` step in the `Tests` job, after `pnpm test:coverage`, and the script it runs (handoff on #220).
- Engine (#220): no code change for this amendment. A rename or move of the calibration test or its test name updates the CI step in the same PR, through a devops handoff.
- The measurement is the duration Vitest reports for that test, which includes building the input. That makes it slightly pessimistic, never optimistic.

**Revisit when** the step's timing becomes flaky near 2,000 ms on shared runners. Then take the median of several runs, and don't raise the target.

## Amendment 4 (2026-10-05, issue #294): a linked course outside the plan is shown as unchecked

**Related:** #221, PR #291 (academic-safety review at `6556a6c`), #294, #296, #297, #298. ADR-0005. Section 2. planning/08 §Candidate formation and §Constraint formulation.

**Context.** Section 2 runs the course-set checks once, on the requested courses. A bundle can also bring in a linked section of a different catalog course. When that course's credits aren't included in a course of the plan (`creditsIncludedInCourseId` is `null` or names a course outside the plan), it adds its own credits, and the option shows it with `countsCredits: true`. An example is DEMO-PHYS 201L, 1.00 credit, linked to PHYS 201. No prerequisite, applicability or allocation check runs on it, yet the option could be VALIDATED. planning/08 validates the complete candidate set and applies prerequisite conditions to every selected section, so a check that never ran can't reach a validated label. The contract recomputes `aggregate` from the visible checks only, so the check can't be hidden in the API either.

Options:

- (i) a new contract field with one result per such course;
- (ii) an UNKNOWN check inside `setResults.allocation`;
- (iii) full course-set checks on the linked courses;
- (iv) state that section 2 excludes linked courses.

(iv) contradicts planning/08. (ii) puts a per-course fact in a set-level list, under a kind that doesn't describe it. (iii) is the end state, but allocation over the larger set changes the requested courses' results per option. That breaks section 2's "same for every option" and needs engine work. **Option (i) now, with UNKNOWN results; (iii) is deferred.**

**Decision.**

- **Which courses.** A linked course needs a result when a bundle has a section of it, it isn't a requested course, and either:
  - it counts its own credits in the plan: its `creditsIncludedInCourseId` is `null` or names a course outside the plan, so its section shows `countsCredits: true`; or
  - the catalog gives it a prerequisite rule of its own.

  A linked course whose credits are included in a course of the plan and has no prerequisite of its own is a component of that course, and that course's checks cover it.

- **The engine owns the rule.** Both the selection and the results are academic, so they live in `@caa/engine` (standard 01, standard 05 §Logic, ADR-0005 rule 6). A pure engine function takes the option's bundles, the requested course IDs and the catalog courses. It reuses the engine's existing `countsOwnCredits` and returns the results. The solver adds them to each option it outputs. The API only maps them into the response, as it maps every other engine result, and restates nothing.
- **Field.** `ScheduleOption.linkedCourseResults`: one `CourseCheckResult` per selected course, in ascending course ID (UTF-16 code units), with no repeats. It is required, and `[]` when there are none.
- **Results in S4.** The prerequisite and the applicability are both UNKNOWN with a new reason code, `LINKED_COURSE_NOT_CHECKED`: "a linked section adds a course that this check didn't verify". `UNSUPPORTED_RULE` is wrong, because nothing about the source rule is unsupported. Allocation stays about the requested courses and adds no result for the linked course.
- **Aggregate.** `listOptionChecks` includes every check in `linkedCourseResults`. Such an option is therefore NEEDS_VERIFICATION, never VALIDATED, and it still ranks by section 4 unchanged. Linked results don't change the schedule feasibility or the outcome.
- **Contract rules are structural only.** No entry names a requested course. Every entry names a course with a section in this option. The entries are sorted and don't repeat. The contract doesn't restate the selection rule. It can't see the catalog's prerequisite rules or the plan's credit inclusion, so it could only check part of the rule, and a second, partial copy is what ADR-0005 rule 5 forbids. No shared invariant is added, because no schema enforces the rule (ADR-0005 rule 1). The engine's tests and the QA acceptance cases prove the selection.

This interprets planning/08 §Candidate formation; it doesn't deviate from it, so it needs no change-control record.

**Order.** Each step keeps `main` green, because no code on `main` builds an option response until #291 merges.

1. Domain (#296): the reason code, the field, the structural rules and `listOptionChecks`. The new code goes through the wording-map ripple (#261), and the schedule-option builder's `linkedCourseResults: []` through the ADR-0004 ripple.
2. Engine (#298) and QA (#297), in parallel after #296. Engine: the selection function and the solver output. QA: AC06 keeps testing fit with a lab whose credits are included in PHYS 201, so it stays VALIDATED. New acceptance cases cover a credit-bearing linked lab and an included lab with its own prerequisite, and both expect NEEDS_VERIFICATION with `LINKED_COURSE_NOT_CHECKED`. They are known findings until #291 merges.
3. API (#291): merges `main`, maps the engine's `linkedCourseResults` into each option, includes them in the aggregate it composes, and removes the known findings. #291 doesn't merge before steps 1 and 2. On the current contract there is no safe interim, and the uncommitted hidden-check attempt returns 500 on AC06.

**Consequences.**

- Domain (#296): `LINKED_COURSE_NOT_CHECKED`, `linkedCourseResults`, the structural rules, `listOptionChecks`, and contract tests for each rule and for the aggregate.
- Engine (#298): the selection function and the solver output, with literal tests for a credit-bearing lab, an included lab (`[]`), an included lab with its own prerequisite, a lab included in a course outside the plan, and shuffle determinism.
- API (#291): no academic rule. Its tests assert that the engine's results reach the response and the aggregate.
- Web: the UI shows each linked course's results like a requested course's, from structured fields only.

**Revisit when** planning needs options with credit-bearing linked courses to be VALIDATED. Then do (iii): run the course-set checks per option on the requested and linked courses together, and amend section 2, because the academic checks would then differ between options.
