# Golden corpus coverage map

Which rule families and interactions the golden corpus covers, and which gaps remain on the way to the 200-case G1 gate (planning/13 §Golden corpus design). Interactions are listed because both S2 engine defects (#88, #89) sat where two families meet.

Status as of 2026-10-05 (#226):

- The development corpus has 113 cases across 20 rule families (`GOLDEN_DEVELOPMENT_CORPUS` in `@caa/test-kit`).
- The holdout has 45 cases, version v0.4 (#226): 31 check cases, so every non-scheduling rule family has at least one, and 14 scheduling cases, which are `it.todo` until the solver exists (#220).
- Every case is `pending-academic-review`.
- No open findings. #183 was settled by tech-lead ruling GR-01 (planning/13 §Golden corpus design, Adjudication rulings), and GC-PF-004 was re-adjudicated from it.
- 48 scheduling cases are planned as `it.todo` in `tests/golden/scheduling.golden.test.ts` (#226). They aren't counted above until they're full cases (see §Scheduling families).

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

| Family                | Development cases                | States  | Boundary cases                        | Holdout |
| --------------------- | -------------------------------- | ------- | ------------------------------------- | ------- |
| MINIMUM_GRADE         | GC-MIN-001–005                   | P F     | GC-MIN-002, GC-MIN-003                | 1       |
| PASS_FAIL_EQUIVALENCE | GC-PF-001–006                    | P F U   | none                                  | 2       |
| PASSING_CUTOFF        | GC-CUT-001–006                   | P F U   | GC-CUT-002, GC-CUT-006                | 2       |
| UNRANKED_GRADE        | GC-UNR-001–002                   | U       | none                                  | 1       |
| IN_PROGRESS           | GC-IP-001–002                    | C F     | none                                  | 1       |
| PENDING_TRANSFER      | GC-PT-001–008                    | P U     | none                                  | 3       |
| INCOMPLETE_ATTEMPT    | GC-INC-001                       | U       | none                                  | 1       |
| REPEAT                | GC-REP-001–014                   | P F U C | GC-REP-005, GC-REP-006, GC-REP-014    | 1       |
| EQUIVALENCY           | GC-EQV-001–003                   | P U     | none                                  | 2       |
| AND_OR_EXPRESSION     | GC-EXP-001–006                   | P F U C | none                                  | 1       |
| UNSUPPORTED_RULE      | GC-UNS-001                       | U       | none                                  | 1       |
| CATALOG_GAP           | GC-CAT-001–002                   | U       | none                                  | 2       |
| APPLICABILITY         | GC-APP-001–010                   | P F U C | none                                  | 2       |
| AUDIT_STALE           | GC-STALE-001–007                 | P U     | GC-STALE-002, GC-STALE-005            | 1       |
| AUDIT_RECORD_MISMATCH | GC-PIN-001–004                   | U       | none                                  | 2       |
| PROGRAM_CATALOG       | GC-PROG-001–006                  | U       | none                                  | 2       |
| ALLOCATION            | GC-ALLOC-001–006                 | P U     | none                                  | 1       |
| CREDIT_BOUNDS         | GC-LOAD-001–009                  | P F U   | GC-LOAD-002, GC-LOAD-003, GC-LOAD-005 | 1       |
| VARIABLE_CREDIT       | GC-VAR-001–003, GC-ALLOC-007–012 | P U     | GC-ALLOC-009, GC-ALLOC-010            | 2       |
| TERM_ORDER            | GC-TERM-001–006                  | P F U   | GC-TERM-005                           | 2       |

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

## Scheduling families (S4, planned)

The scheduling families (T05: AC06–AC08, AC12) are planned in `tests/golden/scheduling.golden.test.ts`. Each is an `it.todo` whose title states the inputs and the adjudicated expectation, from planning/08 §Schedule model and §Constraint formulation, planning/13, planning/14 §First vertical slice and ADR-0010. The scheduling case kind exists: `GoldenScheduleCaseSchema` in `@caa/test-kit` (written with `scheduleCase`), a kind of its own because its expectation is a whole response. Its inputs are the requested courses, a section snapshot with its linked groups, the transition table, the #212 constraints (merged in #251, which also settles GC-HARD-005's half-open unavailable block), the credit policy and the work cap. Its expectation is the #213 outcome shape (outcome, `searchComplete`, options by section set, conflict set, unresolved items) with the #266 schedule reason codes. Each todo becomes a full case in `packages/test-kit/src/golden/cases/` when its engine issue merges, and the runner turns it live then.

States are the planned expectations, with the same letters as §Rule families.

| Family               | Planned cases     | States | Boundary cases           | Unknown cases              | Engine issue |
| -------------------- | ----------------- | ------ | ------------------------ | -------------------------- | ------------ |
| MEETING_OVERLAP      | GC-MEET-001–008   | P F    | GC-MEET-003, GC-MEET-004 | none (see TBA)             | #218         |
| TERM_DATE_OVERLAP    | GC-HALF-001–004   | P F    | GC-HALF-002, GC-HALF-004 | none (see TBA)             | #218         |
| TRANSITION_TIME      | GC-TRAVEL-001–008 | P F U  | GC-TRAVEL-002            | GC-TRAVEL-003–004          | #218         |
| LINKED_SECTION       | GC-LINK-001–007   | P F U  | GC-LINK-005              | GC-LINK-004                | #219         |
| MEETING_TIME_UNKNOWN | GC-TBA-001–006    | P U    | GC-TBA-005, GC-TBA-006   | GC-TBA-001, GC-TBA-004     | #218, #220   |
| HARD_VERSUS_SOFT     | GC-HARD-001–005   | P F    | GC-HARD-005              | none                       | #220         |
| SOLVER_OUTCOME       | GC-SOLVE-001–010  | P F U  | GC-SOLVE-003             | GC-SOLVE-002, GC-SOLVE-008 | #220         |

`SOLVER_OUTCOME` "states" stand for the outcomes: P is `OPTIONS_FOUND`, F is `NO_FEASIBLE_PLAN`, and U is `NEEDS_VERIFICATION` or `SEARCH_TIMEOUT` (GC-SOLVE-002, AC12).

**Holdout (v0.4, counts only):** MEETING_OVERLAP 2, TERM_DATE_OVERLAP 2, TRANSITION_TIME 2, LINKED_SECTION 3, MEETING_TIME_UNKNOWN 1, HARD_VERSUS_SOFT 2, SOLVER_OUTCOME 2.

**Interactions planned:**

- Linked section × meeting overlap: GC-LINK-002, GC-LINK-003 (AC06).
- Linked section × transition time: GC-LINK-007.
- Linked section × credit load (an included lab): GC-LINK-005, GC-LINK-006. This also closes the "included lab" gap under Allocation × reusable × variable credit, for credit load.
- Half-term × TBA: GC-TBA-002.
- Known weekdays × TBA times (ruling GR-02): GC-TBA-005 gives PASS when no possible date is shared, and GC-TBA-006 gives UNKNOWN `MEETING_TIME_UNKNOWN` when one is (GC-TBA-006 is also an unknown case).
- Date overlap × DST: GC-MEET-007, GC-MEET-008.
- TBA × hard availability: GC-TBA-004.
- Transition time × ranking (UNKNOWN after PASS): GC-SOLVE-010.
- Solver precedence (FAIL before UNKNOWN): GC-SOLVE-009.

**Open gaps and questions:**

- No `HARD_VERSUS_SOFT` unknown case beyond GC-TBA-004. Add one for an allowed-campus constraint against a meeting with a TBA location.
- Scheduling holdout: done in v0.4 (14 cases). MEETING_TIME_UNKNOWN has only one, so the next refresh should add a second.
- Multi-meeting sections (a lecture with an MWF meeting and a separate Friday exam slot) aren't planned yet.

## Path to the 200-case G1 gate

There are 158 cases today (113 development, 45 holdout, of which the 14 scheduling holdout cases run once #220 merges). The remaining 42 or more should come from:

1. **The open interaction gaps above:** about 20 cases, all testable with today's engine.
2. **The family gaps above** (boundary and unknown cases): about 12 cases.
3. **A holdout refresh** for the 10 families that had no holdout case: done in v0.3 (16 cases, #226). The scheduling families followed in v0.4 (14 cases, #226).
4. **Families the engine doesn't support yet**, each added with its engine feature:
   - co-requisites;
   - permission requirements;
   - placement and cohort restrictions;
   - credit and residency limits;
   - approved exceptions (AC17);
   - catalog-year rules (AC09);
   - scheduling (T05: AC06–AC08, AC12): 48 cases planned (§Scheduling families).

   The non-scheduling families add about 30 or more cases. Every case is filed as `it.todo` with the issue number until the feature exists.

Academic sign-off by a domain owner remains open for every case (G1).
