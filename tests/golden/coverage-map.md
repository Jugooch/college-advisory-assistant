# Golden corpus coverage map

Which rule families and interactions the golden corpus covers, and which gaps remain on the way to the 200-case G1 gate (planning/13 §Golden corpus design). Interactions are listed because both S2 engine defects (#88, #89) sat where two families meet.

Status as of 2026-10-08 (#226):

- The development corpus has 201 cases: 123 check cases across 20 rule families (`GOLDEN_DEVELOPMENT_CORPUS` in `@caa/test-kit`), 20 repeat-for-credit counting cases (`GOLDEN_DEVELOPMENT_COUNTING_CORPUS`, GC-RCR-001–020, run through `resolveAttempts`; their expectation is earned credit, which no check carries), and 68 scheduling cases across 7 scheduling families. 31 of the scheduling cases are section pairs run through `findMeetingConflicts` (inside `GOLDEN_DEVELOPMENT_CORPUS`), and 37 are solver cases run through `buildSectionBundles` and `solveSchedule` (`GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS`).
- The holdout has 49 cases, version v0.5 (#226): 31 check cases, so every non-scheduling rule family has at least one, and 18 scheduling cases, which now run through the solver.
- Every case is `pending-academic-review`.
- No open findings. #183 was settled by tech-lead ruling GR-01 (planning/13 §Golden corpus design, Adjudication rulings), and GC-PF-004 was re-adjudicated from it.
- GH-LINK-002 was re-adjudicated in v0.5 from ADR-0010 Amendment 5 (#287): a section dropped for a missing linked lab is shown in `unresolved` beside the options. The expectation schema allows `unresolved` on `OPTIONS_FOUND` and `SEARCH_TIMEOUT` for `LINKED_SECTION_UNAVAILABLE` only.

Keep this file current in the same PR that adds, burns or re-adjudicates a case.

## Holdout

This map gives holdout **counts only**. Holdout IDs, titles and inputs stay in `tests/golden/holdout/`, which engine engineers don't read (see its README). Development case IDs are open to everyone.

## Rule families

States are the adjudicated `expected` states:

- P: PASS
- F: FAIL
- U: UNKNOWN
- C: CONDITIONAL

"Boundary" lists cases that sit exactly on a limit or one step past it.

| Family                | Development cases                | States  | Boundary cases                                                         | Holdout |
| --------------------- | -------------------------------- | ------- | ---------------------------------------------------------------------- | ------- |
| MINIMUM_GRADE         | GC-MIN-001–005                   | P F     | GC-MIN-002, GC-MIN-003                                                 | 1       |
| PASS_FAIL_EQUIVALENCE | GC-PF-001–006                    | P F U   | none                                                                   | 2       |
| PASSING_CUTOFF        | GC-CUT-001–006                   | P F U   | GC-CUT-002, GC-CUT-006                                                 | 2       |
| UNRANKED_GRADE        | GC-UNR-001–002                   | U       | none                                                                   | 1       |
| IN_PROGRESS           | GC-IP-001–002                    | C F     | none                                                                   | 1       |
| PENDING_TRANSFER      | GC-PT-001–008                    | P U     | none                                                                   | 3       |
| INCOMPLETE_ATTEMPT    | GC-INC-001                       | U       | none                                                                   | 1       |
| REPEAT                | GC-REP-001–017, GC-RCR-001–020   | P F U C | GC-REP-005, GC-REP-006, GC-REP-014, GC-RCR-002, GC-RCR-003, GC-RCR-006 | 1       |
| EQUIVALENCY           | GC-EQV-001–003                   | P U     | none                                                                   | 2       |
| AND_OR_EXPRESSION     | GC-EXP-001–006                   | P F U C | none                                                                   | 1       |
| UNSUPPORTED_RULE      | GC-UNS-001                       | U       | none                                                                   | 1       |
| CATALOG_GAP           | GC-CAT-001–002                   | U       | none                                                                   | 2       |
| APPLICABILITY         | GC-APP-001–010                   | P F U C | none                                                                   | 2       |
| AUDIT_STALE           | GC-STALE-001–007                 | P U     | GC-STALE-002, GC-STALE-005                                             | 1       |
| AUDIT_RECORD_MISMATCH | GC-PIN-001–004                   | U       | none                                                                   | 2       |
| PROGRAM_CATALOG       | GC-PROG-001–006                  | U       | none                                                                   | 2       |
| ALLOCATION            | GC-ALLOC-001–006                 | P U     | none                                                                   | 1       |
| CREDIT_BOUNDS         | GC-LOAD-001–009                  | P F U   | GC-LOAD-002, GC-LOAD-003, GC-LOAD-005                                  | 1       |
| VARIABLE_CREDIT       | GC-VAR-001–003, GC-ALLOC-007–012 | P U     | GC-ALLOC-009, GC-ALLOC-010                                             | 2       |
| TERM_ORDER            | GC-TERM-001–006                  | P F U   | GC-TERM-005                                                            | 2       |

**Family gaps** (planning/13 release gate: every supported family needs positive, negative, boundary and unknown cases):

- **UNKNOWN missing:** MINIMUM_GRADE has none of its own. The unknowns for a minimum grade sit in PASS_FAIL_EQUIVALENCE and UNRANKED_GRADE.
- **One case or one state only:**
  - UNKNOWN-only by nature, with no positive or negative case: UNSUPPORTED_RULE, INCOMPLETE_ATTEMPT, CATALOG_GAP.
  - UNKNOWN-only so far: AUDIT_RECORD_MISMATCH, PROGRAM_CATALOG (no matching-record PASS case in the family).
- **No boundary case:** IN_PROGRESS, EQUIVALENCY, PENDING_TRANSFER, ALLOCATION (room exactly used by fixed credits), APPLICABILITY.
- **No holdout case:** none among the rule families above since v0.3.

## Interactions

Each interaction lists its development cases, its holdout count, and the gaps still open.

### Repeat policy × in-progress × pending transfer × progression

- **Development:** GC-PT-003–008, GC-REP-008, GC-REP-010, GC-REP-012, GC-REP-013, GC-INC-001.
- **Holdout:** 2.
- **Open gaps:**
  - an in-progress **equivalent** (DEMO-MATH 111) beside a pending transfer;
  - a HIGHEST_GRADE retake of a passed course beside a pending transfer;
  - forbidden progression under HIGHEST_GRADE with a pending transfer.

### Passing cutoff × pass/fail

- **Development:** GC-PF-004–006, GC-CUT-005, GC-CUT-006.
- **Holdout:** 1.
- **Open gaps:**
  - a P under "any passing completion" with no cutoff at all (GR-01 settles it as PASS; no case yet);
  - HIGHEST_GRADE mixing P and letters under a cutoff.

### Applicability × ancestor states × staleness

- **Development:** GC-APP-006, GC-APP-008–010, GC-STALE-006, GC-STALE-007, GC-PROG-005.
- **Holdout:** 2.
- **Open gaps:**
  - a stale audit together with a program mismatch (which reason is reported);
  - an ancestor tree under a record-identity mismatch (GC-PIN).

### Allocation × reusable × variable credit

- **Development:** GC-ALLOC-003, GC-ALLOC-005, GC-ALLOC-007–012.
- **Holdout:** 3.
- **Open gaps:**
  - an included lab (`countsCredits: false`) in allocation;
  - a variable credit shared by two non-reusable requirements;
  - room on an IN_PROGRESS requirement or under an IN_PROGRESS ancestor.

### Allocation × staleness, pinning and program

- **Development:** GC-STALE-003, GC-PIN-002, GC-PROG-002, GC-PROG-004, GC-PROG-006.
- **Holdout:** 1.
- **Open gaps:** holdout coverage of staleness and record identity in allocation.

### Credit load × variable credit × bounds

- **Development:** GC-VAR-001–003, GC-LOAD-008.
- **Holdout:** 1.
- **Open gaps:** a chosen value at the course minimum or maximum that lands exactly on a load bound.

### Term order × repeat

- **Development:** GC-TERM-001–006, GC-REP-005, GC-EQV-002.
- **Holdout:** 2.
- **Open gaps:** a calendar gap between an in-progress and a completed attempt.

### Expression × attempt status

- **Development:** GC-EXP-001, GC-EXP-004, GC-EXP-006.
- **Holdout:** 1.
- **Open gaps:**
  - an ALL of an in-progress leaf and a pending-transfer leaf;
  - an unsupported leaf under an ALL with a conditional sibling.

### Repeat ties × earned credit

- **Development:** GC-REP-006, GC-REP-014.
- **Holdout:** 0.
- **Open gaps:** a HIGHEST_GRADE tie across an equivalent course, or across a transfer award (issue #78: these stay UNDETERMINED).

## Scheduling families (S4)

**Live.** Every planned scheduling case is now a full case. The section-pair cases run through `findMeetingConflicts` as check cases (`check: SCHEDULE_FEASIBILITY`, written with `meetingConflictCase`, #218): GC-MEET-001–014, GC-HALF-001–004, GC-TRAVEL-001–006 and -008, and GC-TBA-001–003, -005, -006 and -007. The solver cases are scheduling cases (`GoldenScheduleCaseSchema`, written with `scheduleCase`), run by `tests/support/golden-schedule-runner.ts` through `buildSectionBundles` and `solveSchedule` (#219, #220): GC-TRAVEL-007, GC-TBA-004, GC-LINK-001–008, GC-HARD-001–007 and GC-SOLVE-001–020. A scheduling case's inputs are the requested courses, a section snapshot with its linked groups, the transition table, the #212 constraints, the credit policy and the work cap. Its expectation is the #213 outcome shape with the #266 reason codes, compared on the facts the case states. Expected values come from planning/08, planning/13, ADR-0010 and its amendments, never from engine output. GC-MEET-001's shared dates start on the first Wednesday, 2027-01-13, the first date both meetings meet.

States use the same letters as §Rule families.

| Family               | Development cases | States | Boundary cases                                                                     | Unknown cases                                          | Holdout |
| -------------------- | ----------------- | ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| MEETING_OVERLAP      | GC-MEET-001–014   | P F    | GC-MEET-003, GC-MEET-004, GC-MEET-012, GC-MEET-013                                 | none (see TBA)                                         | 2       |
| TERM_DATE_OVERLAP    | GC-HALF-001–004   | P F    | GC-HALF-002, GC-HALF-004                                                           | none (see TBA)                                         | 2       |
| TRANSITION_TIME      | GC-TRAVEL-001–008 | P F U  | GC-TRAVEL-002                                                                      | GC-TRAVEL-003–004                                      | 2       |
| LINKED_SECTION       | GC-LINK-001–008   | P F U  | GC-LINK-005                                                                        | GC-LINK-004                                            | 4       |
| MEETING_TIME_UNKNOWN | GC-TBA-001–007    | P U    | GC-TBA-005, GC-TBA-006                                                             | GC-TBA-001, GC-TBA-004, GC-TBA-006, GC-TBA-007         | 2       |
| HARD_VERSUS_SOFT     | GC-HARD-001–007   | P F U  | GC-HARD-005                                                                        | GC-HARD-006                                            | 3       |
| SOLVER_OUTCOME       | GC-SOLVE-001–020  | P F U  | GC-SOLVE-003, GC-SOLVE-004, GC-SOLVE-012, GC-SOLVE-013, GC-SOLVE-016, GC-SOLVE-018 | GC-SOLVE-002, GC-SOLVE-008, GC-SOLVE-014, GC-SOLVE-020 | 3       |

`SOLVER_OUTCOME` "states" stand for the outcomes: P is `OPTIONS_FOUND`, F is `NO_FEASIBLE_PLAN`, and U is `NEEDS_VERIFICATION` or `SEARCH_TIMEOUT` (GC-SOLVE-002, AC12).

**Holdout (v0.5, counts only):** MEETING_OVERLAP 2, TERM_DATE_OVERLAP 2, TRANSITION_TIME 2, LINKED_SECTION 4, MEETING_TIME_UNKNOWN 2, HARD_VERSUS_SOFT 3, SOLVER_OUTCOME 3.

**Interactions covered:**

- Linked section × meeting overlap: GC-LINK-002, GC-LINK-003 (AC06).
- Linked section × transition time: GC-LINK-007.
- Linked section × credit load (an included lab, a separately credited lab): GC-LINK-005, GC-LINK-006. This also closes the "included lab" gap under Allocation × reusable × variable credit, for credit load.
- Linked section with two components (lab and recitation): GC-LINK-008.
- Half-term × TBA: GC-TBA-002.
- Known weekdays × TBA times (ruling GR-02): GC-TBA-005 gives PASS when no possible date is shared, and GC-TBA-006 gives UNKNOWN `MEETING_TIME_UNKNOWN` when one is.
- Date overlap × DST: GC-MEET-007, GC-MEET-008.
- TBA × hard availability: GC-TBA-004.
- TBA location × hard campus rule: GC-HARD-006.
- Three-section travel (every pair counts): GC-TRAVEL-007.
- Transition time × ranking (UNKNOWN after PASS): GC-SOLVE-010.
- Solver precedence (FAIL before UNKNOWN): GC-SOLVE-009.
- Work cap × candidates: GC-SOLVE-002 to -004 (timeout, exact cap, incomplete options).
- Multi-meeting sections (a weekly lecture and a one-day Friday exam slot, #226): GC-MEET-009 (PASS), GC-MEET-010 (only the exam slots conflict), GC-MEET-011 (only the weekly meetings conflict), GC-MEET-012 and -013 (exam slots exactly abutting, one minute over), GC-TBA-007 (a TBA second meeting, UNKNOWN), GC-MEET-014 (FAIL outranks a TBA UNKNOWN in the same pair).
- Conflict-set cap (ADR-0010 §5, #226): GC-SOLVE-011 (25 conflicts, 20 shown, `omittedCount` 5), GC-SOLVE-012 (exactly 20, none omitted), GC-SOLVE-013 (21, one omitted), GC-SOLVE-014 (25 UNKNOWN pairs give options and no conflict set).
- Chosen variable credit inside a bundle (`creditSelections`, AC18, #226): GC-SOLVE-015 (counted exactly), -016 (exactly the term maximum), -017 (0.50 over it, no plan), -018 (course minimum exactly on the term minimum), -019 (0.50 under it, no plan), -020 (unchosen value that straddles the bound, UNKNOWN).
- Dropped linked section × options or timeout (Amendment 5): holdout only, by design.

**Open gaps and questions:**

- No development case yet for a hard credit range that intersects the policy bounds from one side only.
- Multi-meeting sections with a campus change between meetings (travel across a section's own meetings) have no case.
- A requested course whose linked component is variable-credit isn't covered (a selection must name a requested course).
- Requests of more than 4 courses, or a deep search near the default cap, have no case; the engine's own tests cover the worst input.
- Linked courses outside the plan (`linkedCourseResults`, Amendment 4) aren't compared by the case format. AC06 covers them at the API.

## Path to the 200-case G1 gate

There are 250 cases today (201 development, 49 holdout), so the count is met. The gate also needs every supported family to have positive, negative, boundary and unknown cases, and academic sign-off. What is left:

1. **The open interaction gaps above:** about 20 cases, all testable with today's engine, plus the scheduling gaps listed under §Scheduling families.
2. **The family gaps above** (boundary and unknown cases): about 12 cases.
3. **Families the engine doesn't support yet**, each added with its engine feature as an `it.todo` with the issue number until the feature exists:
   - co-requisites;
   - permission requirements;
   - placement and cohort restrictions;
   - credit and residency limits;
   - approved exceptions (AC17);
   - catalog-year rules (AC09).

   These add about 30 or more cases.

4. **Holdout refresh:** the holdout reached every scheduling family in v0.4 and v0.5. The next cut should add families as their engine features land, and burned cases are replaced as the README describes.

Academic sign-off by a domain owner remains open for every case (G1).
