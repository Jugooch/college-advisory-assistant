# Golden corpus coverage map

Which rule families and interactions the golden corpus covers, and which gaps remain on the way to the 200-case G1 gate (planning/13 §Golden corpus design). Interactions are listed because both S2 engine defects (#88, #89) sat where two families meet.

Status as of 2026-09-29 (#103):

- The development corpus has 113 cases across 20 rule families (`GOLDEN_DEVELOPMENT_CORPUS` in `@caa/test-kit`).
- The holdout has 15 cases, version v0.2.
- Every case is `pending-academic-review`.
- One open finding: GC-PF-004 (#183).

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
| PASSING_CUTOFF        | GC-CUT-001–006                   | P F U   | GC-CUT-002, GC-CUT-006                | 0       |
| UNRANKED_GRADE        | GC-UNR-001–002                   | U       | none                                  | 0       |
| IN_PROGRESS           | GC-IP-001–002                    | C F     | none                                  | 0       |
| PENDING_TRANSFER      | GC-PT-001–008                    | P U C   | none                                  | 3       |
| INCOMPLETE_ATTEMPT    | GC-INC-001                       | U       | none                                  | 0       |
| REPEAT                | GC-REP-001–014                   | P F U C | GC-REP-005, GC-REP-006, GC-REP-014    | 1       |
| EQUIVALENCY           | GC-EQV-001–003                   | P U     | none                                  | 0       |
| AND_OR_EXPRESSION     | GC-EXP-001–006                   | P F U C | none                                  | 1       |
| UNSUPPORTED_RULE      | GC-UNS-001                       | U       | none                                  | 0       |
| CATALOG_GAP           | GC-CAT-001–002                   | U       | none                                  | 0       |
| APPLICABILITY         | GC-APP-001–010                   | P F U C | none                                  | 2       |
| AUDIT_STALE           | GC-STALE-001–007                 | P U     | GC-STALE-002, GC-STALE-005            | 1       |
| AUDIT_RECORD_MISMATCH | GC-PIN-001–004                   | U       | none                                  | 0       |
| PROGRAM_CATALOG       | GC-PROG-001–006                  | U       | none                                  | 0       |
| ALLOCATION            | GC-ALLOC-001–006                 | P U     | none                                  | 1       |
| CREDIT_BOUNDS         | GC-LOAD-001–009                  | P F U   | GC-LOAD-002, GC-LOAD-003, GC-LOAD-005 | 1       |
| VARIABLE_CREDIT       | GC-VAR-001–003, GC-ALLOC-007–012 | P U     | GC-ALLOC-009, GC-ALLOC-010            | 2       |
| TERM_ORDER            | GC-TERM-001–006                  | P F U   | GC-TERM-005                           | 0       |

**Family gaps** (planning/13 release gate: every supported family needs positive, negative, boundary and unknown cases):

- **UNKNOWN missing:** MINIMUM_GRADE has none of its own. The unknowns for a minimum grade sit in PASS_FAIL_EQUIVALENCE and UNRANKED_GRADE.
- **One case or one state only:**
  - UNKNOWN-only by nature, with no positive or negative case: UNSUPPORTED_RULE, INCOMPLETE_ATTEMPT, CATALOG_GAP.
  - UNKNOWN-only so far: AUDIT_RECORD_MISMATCH, PROGRAM_CATALOG (no matching-record PASS case in the family).
- **No boundary case:** IN_PROGRESS, EQUIVALENCY, PENDING_TRANSFER, ALLOCATION (room exactly used by fixed credits), APPLICABILITY.
- **No holdout case:** 11 families.

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
  - a P under "any passing completion" with no cutoff, which waits for the #183 decision;
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
- **Holdout:** 0.
- **Open gaps:** holdout coverage.

### Credit load × variable credit × bounds

- **Development:** GC-VAR-001–003, GC-LOAD-008.
- **Holdout:** 1.
- **Open gaps:** a chosen value at the course minimum or maximum that lands exactly on a load bound.

### Term order × repeat

- **Development:** GC-TERM-001–006, GC-REP-005, GC-EQV-002.
- **Holdout:** 0.
- **Open gaps:** holdout coverage; a calendar gap between an in-progress and a completed attempt.

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

## Path to the 200-case G1 gate

There are 128 cases today (113 development, 15 holdout). The remaining 72 or more should come from:

1. **The open interaction gaps above:** about 20 cases, all testable with today's engine.
2. **The family gaps above** (boundary and unknown cases): about 12 cases.
3. **A holdout refresh** for the 11 families with no holdout case: about 11 cases, to be cut as v0.3.
4. **Families the engine doesn't support yet**, each added with its engine feature:
   - co-requisites;
   - permission requirements;
   - placement and cohort restrictions;
   - credit and residency limits;
   - approved exceptions (AC17);
   - catalog-year rules (AC09);
   - scheduling (T05: AC06–AC08, AC12).

   These are about 30 or more cases, filed as `it.todo` with the issue number until the feature exists.

Academic sign-off by a domain owner remains open for every case (G1).
