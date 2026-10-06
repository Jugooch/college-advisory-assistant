# ADR-0010: Deterministic bounded schedule solver

- **Status:** Accepted; amended 2026-09-29 to 2026-10-06 (Amendments 1–7)
- **Date:** 2026-09-29
- **Deciders:** Repo owner (budget, course choice, travel time, sprint size), orchestrator (endpoint, outcome field, deferrals), tech lead
- **Related:** FR-07, FR-08, FR-18, NFR-01, NFR-07, AC06, AC07, AC08, AC12, planning/07 §Request lifecycle, planning/08 §Schedule model and §Constraint formulation, planning/09 §Logical app interfaces, ADR-0005, ADR-0008, issues #209, #210, #212, #213, #218, #219, #220, #221, #294, #310, #322

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

## Amendment 5 (2026-10-06, issue #287): sections dropped for missing data are shown when the search runs

**Related:** #281 (correctness review at `88fd893`, fix at `21aaf24`), #287, #302, #303, #304, #305, Amendment 4. Sections 1 and 5. planning/08 §Candidate formation.

**Context.** A course keeps its other bundles when some of its sections are dropped because a required linked component has no permitted section (`LINKED_SECTION_UNAVAILABLE`). The search then runs without those sections. If it finds nothing, #281 already returns `NEEDS_VERIFICATION` with the dropped results in `unresolved`. If it finds options, or the cap stops it, the result keeps no trace of them, and section 5's table has no field for them. A complete `OPTIONS_FOUND` then says its options are the best 3, although a dropped section might have formed a better one. The student isn't told that the section exists and couldn't be planned. That hides an UNKNOWN, which the safety rules forbid, and claims an optimality the search didn't prove (Consequences).

Options:

- (a) put them in the response's `unresolved` on `OPTIONS_FOUND` and `SEARCH_TIMEOUT`;
- (b) attach them to each option;
- (c) document that they're omitted.

(c) hides missing data. (b) puts a fact about sections no option contains into every option, repeated, and would make each option's aggregate NEEDS_VERIFICATION for a check about something else. **Option (a).** It follows Amendment 4: a fact the engine couldn't check is shown as UNKNOWN, not dropped.

**Decision.**

- **`unresolved` whenever the search ran.** `OPTIONS_FOUND` and `SEARCH_TIMEOUT` carry the dropped sections' UNKNOWN `LINKED_SECTION_UNAVAILABLE` results in `unresolved`, the same results and order that #281 gives `NEEDS_VERIFICATION`. It is `[]` when no section was dropped. `SECTION_DATA_MISSING` never appears there, because a course with no sections stops before the search.
- **Nothing else changes.** The outcome, `searchComplete`, the options, their ranking and each option's aggregate are the same as before. An option's checks are about its own sections, and it contains no dropped section. `searchComplete` still reports only the cap.
- **What "best" means.** A complete `OPTIONS_FOUND` with a non-empty `unresolved` has the best 3 options among the sections with complete data. The UI says that some sections couldn't be considered and names them from the structured results. It doesn't call the options the best overall.
- **Contract rules.** `OPTIONS_FOUND` and `SEARCH_TIMEOUT` may have a non-empty `unresolved`, and every entry is `LINKED_SECTION_UNAVAILABLE`. `NEEDS_VERIFICATION` still needs at least one entry, and `NO_FEASIBLE_PLAN` still has none.

| `outcome`            | `unresolved`                                 |
| -------------------- | -------------------------------------------- |
| `OPTIONS_FOUND`      | `[]` or `LINKED_SECTION_UNAVAILABLE` results |
| `NO_FEASIBLE_PLAN`   | `[]`                                         |
| `SEARCH_TIMEOUT`     | `[]` or `LINKED_SECTION_UNAVAILABLE` results |
| `NEEDS_VERIFICATION` | at least one result (section 5, unchanged)   |

This interprets planning/08 §Candidate formation; it doesn't deviate from it, so it needs no change-control record.

**Order.** Each step keeps `main` green. The API already passes the engine's `unresolved` through, so the contract must accept the field before the engine fills it.

1. Domain (#302): relax the outcome-shape rule as above. Today's responses still parse.
2. Engine (#303), after step 1: return the dropped results on `OPTIONS_FOUND` and `SEARCH_TIMEOUT`.
3. API (#304) and QA (#305) in parallel, after step 2. API: tests that the results reach the response unchanged and that option aggregates don't change. QA: acceptance cases for both outcomes.

**Consequences.**

- Domain: the outcome-shape rule and contract tests for each row of the table.
- Engine: literal tests for a course with one dropped section and options found, a capped search with a dropped section, and shuffle determinism of `unresolved`.
- API: no academic rule and no mapping change.
- Web: the schedule-options screen shows `unresolved` on every outcome, from structured fields only.

**Revisit when** the engine can check a dropped section some other way, for example when published section data gains linked sections the registrar adds later.

## Amendment 6 (2026-10-06, issue #310): the planner lists only terms it could plan

**Related:** #223, PR #309, #310, #313, #314, #315, #316. Section on freshness. ADR-0008 and its Amendment 1. planning/09 §Logical app interfaces.

**Context.** The planner form (#309) asks for a raw term ID, because no endpoint lists the terms a student can plan for. A picker needs a rule for which terms it offers. Schedule options already refuses a term with no published snapshot (503), a tie for latest (409), or a snapshot past `ACADEMIC_SOURCE_MAX_AGE_MS` (409, ADR-0008). Options:

- (a) list every term with a published snapshot;
- (b) list those terms with a server-derived status, so the UI can show stale ones as unavailable;
- (c) list only the terms whose latest snapshot would pass the schedule-options gate now.

(a) offers terms the gate refuses, so the student finds out only after building a request. (b) adds a freshness marker to a contract, which ADR-0008 Amendment 1 avoided until a historical-view UX is designed. **Option (c).**

**Decision.**

- **Plannable term.** A tenant term is plannable when its latest published section snapshot is unique (no tie for the newest `sourceEffectiveAt`) and that time passes `isSourceFresh` with the schedule-options policy: the same maximum age, injected clock, missing-time rule and 5-minute future tolerance. Nothing else decides. The student record and the audit aren't checked here; schedule options checks them on each request.
- **Endpoint.** `GET /v1/students/:studentId/plannable-terms`, read-only, with access as for schedule options. The tenant comes from the session. The response is `{ terms }`, each with `id`, `termCode`, `startsOn` and `endsOn`, in the tenant's term order. It has no freshness marker and no snapshot ID: every listed term is plannable by definition, the same reasoning as ADR-0008 Amendment 1. Stale and tied terms are left out and logged with their reason. If nothing is plannable, the response is 200 with `terms: []`, and the UI shows an advisor referral instead of a picker.
- **The gate still runs.** A listed term can go stale before the student submits, so schedule options keeps its own gate and its 409 unchanged. The list is a convenience, not a pinned input.
- **Ended terms.** No calendar-date filter is added. A registrar feed stops publishing an ended term, so its snapshot ages out within the maximum age.

This adds an endpoint that planning/09 doesn't list, so planning/09 gets a decision note pointing here. It doesn't change any planning requirement.

**Order.** Each step keeps `main` green.

1. Domain (#313), the contract, and data (#314), a repository query that lists each term's latest snapshot without loading its sections. These two run in parallel.
2. API (#315), after both.
3. Web (#316), after #315: the picker replaces the term ID field.

**Consequences.**

- Standard 05 §Source freshness names this endpoint as a filter on the same check, not a 409.
- No new setting. Changing `ACADEMIC_SOURCE_MAX_AGE_MS` changes the list and the gate together.

**Revisit when** a historical-view UX is designed (ADR-0008 Amendment 1) and the UI should show unavailable terms with a reason, or when a term's plannability depends on the student, for example their program or registration window.

## Amendment 7 (2026-10-06, issue #322): the response names its term and campuses

**Related:** #321, #322, #327, #328, #329, #330, #331, #332, Amendment 6. Section 5. Standard 04 rule 10, standard 08 §Required-field ripple (staged rollout).

**Context.** The schedule-options response carries term and campus IDs only, so the results show campuses by ID and the cards have no term label (#321). Options:

- (a) add display data to the response: the requested term and the campuses it names, as `courses` already does for catalog display fields;
- (b) have the web reuse the plannable-terms list (Amendment 6) and add a campus lookup endpoint.

(b) joins two reads taken at different times. The plannable-terms list is a "now" view: a term can leave it when it goes stale, while a result for that term is still on screen. No campus endpoint exists, so (b) also adds an endpoint, a contract and a client call for a page that already has the IDs. **Option (a).**

**Decision.**

- **`term`.** The requested term as `{ id, termCode, startsOn, endsOn }`, the same fields as a plannable term. The API takes it from the term calendar the request already reads.
- **`campuses`.** `{ id, name }` for exactly the campus IDs the response contains, wherever they appear: the options, their checks, the conflict set and `unresolved`. The contract carries campus IDs in these places, and only these:
  - each section's `campusId`, when not null;
  - each meeting's `location.campusId`, when the location is `ON_CAMPUS`. It can differ from its section's `campusId`;
  - `fromCampusId` and `toCampusId` of each `TRANSITION_TIME_INSUFFICIENT` and `TRANSITION_TIME_UNDEFINED` issue;
  - `campusId` of each `CAMPUS_NOT_ALLOWED` issue.

  Sorted ascending by `id` in UTF-16 code units, as `<` compares (not `localeCompare`). No repeats, no extras (data minimization). `[]` when the response contains no campus ID. A new contract field or issue kind that carries a campus ID joins this list.

- **Display only.** Names never feed the engine, ranking, pinned inputs or identity. Campus names aren't versioned with the section snapshot, so the response shows the current name for a pinned campus ID. A named campus with no row is a source failure (503 `SOURCE_UNAVAILABLE`), never a guessed or dropped name.

**Order.** Each step keeps `main` green. Web tests build responses with the test-kit builder, so it gains the fields before they become required.

1. Domain (#327): both fields `.optional()`, with the contract rules above. Data (#328) in parallel: `CampusRepository.findByIds`.
2. API (#329), after both, and QA (#330), after #327: the API sets both fields on every 200; the builder defaults them.
3. Domain (#331), after #329 and #330: both fields required.
4. Web (#332), after #331: show names and the term label.

**Consequences.**

- One more tenant-scoped read per schedule-options request, by primary key.
- The web keeps one source of truth per result and needs no extra request.

**Revisit when** campus names must be shown as they were at the snapshot's time, which would need campus data in the section snapshot.
