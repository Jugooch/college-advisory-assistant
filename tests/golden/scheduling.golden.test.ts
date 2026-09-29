/**
 * @file The planned scheduling golden cases (T05), filed as `it.todo` with the engine issue that
 *   makes each one runnable. Each title states the inputs and the adjudicated expectation, taken
 *   from planning/08 §Schedule model and §Constraint formulation, planning/13 (AC06–AC08, AC12),
 *   planning/14 §First vertical slice and ADR-0010, never from engine output. When the scheduling
 *   golden case kind exists (#212, #213), each todo becomes a full case in
 *   `packages/test-kit/src/golden/cases/`, with the same ID and expectation.
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, it } from 'vitest';

// NOTE: every case uses SYNTHETIC_SCHEDULE_TERM (2027SP, 2027-01-11 to 2027-05-07, local to
// America/Chicago, halves split at 2027-03-05 / 2027-03-08, DST on 2027-03-14) and
// SYNTHETIC_CAMPUSES (north, south). Section IDs ascend in the order sections are named. Reason
// codes are the names #212 lists and ADR-0010 settles; if #212 renames one, the case follows it.

describe('golden scheduling cases: MEETING_OVERLAP (#218)', () => {
  it.todo(
    'GC-MEET-001 (#218): MWF 10:00–10:50 vs WF 10:30–11:20, whole term, same campus → SCHEDULE_FEASIBILITY FAIL MEETING_CONFLICT naming both sections, a shared weekday, both local time ranges and the dates 2027-01-11 to 2027-05-07',
  );
  it.todo(
    'GC-MEET-002 (#218): MWF 09:00–09:50 vs TTh 09:00–09:50, whole term, same campus → PASS (no shared weekday)',
  );
  it.todo(
    'GC-MEET-003 (#218, boundary): MWF 09:00–09:50 then MWF 09:50–10:40, same campus → PASS (half-open intervals; the same campus needs no transition)',
  );
  it.todo(
    'GC-MEET-004 (#218, boundary): MWF 09:00–09:51 vs MWF 09:50–10:40, same campus → FAIL MEETING_CONFLICT (one minute of overlap)',
  );
  it.todo(
    'GC-MEET-005 (#218): a Saturday-only meeting on 2027-02-13 vs a weekly Saturday 10:00–12:00 meeting that excludes 2027-02-13, same times → PASS (the only shared date is excluded)',
  );
  it.todo(
    'GC-MEET-006 (#218): the GC-MEET-005 meetings with no excluded date → FAIL MEETING_CONFLICT naming 2027-02-13 as the overlapping date range',
  );
  it.todo(
    'GC-MEET-007 (#218, DST): MWF 09:00–09:50 vs MWF 10:00–10:50, both 2027-03-08 to 2027-05-07 across the 2027-03-14 DST change → PASS (local wall-clock times never shift)',
  );
  it.todo(
    'GC-MEET-008 (#218, DST): MWF 09:00–09:50 vs MWF 09:30–10:20, both 2027-03-08 to 2027-05-07 → FAIL MEETING_CONFLICT with dates 2027-03-08 to 2027-05-07, on both sides of the DST change',
  );
});

describe('golden scheduling cases: TERM_DATE_OVERLAP (#218, AC07)', () => {
  it.todo(
    'GC-HALF-001 (#218, AC07): MWF 09:00–09:50 in the first half vs the same time in the second half → PASS (disjoint half-terms)',
  );
  it.todo(
    'GC-HALF-002 (#218, boundary): a first-half MWF 09:00–09:50 meeting vs one at the same time from Friday 2027-03-05 → FAIL MEETING_CONFLICT naming 2027-03-05 as the only overlapping date',
  );
  it.todo(
    'GC-HALF-003 (#218): a first-half MWF 09:00–09:50 meeting vs a whole-term one at the same time → FAIL MEETING_CONFLICT with dates 2027-01-11 to 2027-03-05',
  );
  it.todo(
    'GC-HALF-004 (#218, boundary): a first-half MWF meeting vs a TTh meeting at the same time from 2027-03-05 → PASS (calendar ranges share 2027-03-05 but no meeting instance does)',
  );
});

describe('golden scheduling cases: TRANSITION_TIME (#218, AC08)', () => {
  it.todo(
    'GC-TRAVEL-001 (#218, AC08): north MWF 09:00–09:50 then south MWF 10:00–10:50, north→south 15 minutes → FAIL TRANSITION_TIME_INSUFFICIENT naming both campuses, 15 required and 10 available',
  );
  it.todo(
    'GC-TRAVEL-002 (#218, boundary): the GC-TRAVEL-001 meetings with north→south 10 minutes → PASS (the gap equals the required time)',
  );
  it.todo(
    'GC-TRAVEL-003 (#218, unknown): north MWF 09:00–09:50 then south MWF 11:00–11:50 with an empty transition table → UNKNOWN TRANSITION_TIME_UNDEFINED, whatever the 70-minute gap; never PASS',
  );
  it.todo(
    'GC-TRAVEL-004 (#218, unknown): north then south back to back, the table lists only south→north 10 → UNKNOWN TRANSITION_TIME_UNDEFINED (pairs are ordered from the earlier meeting)',
  );
  it.todo(
    'GC-TRAVEL-005 (#218): north MWF 09:00–09:50 then north MWF 09:50–10:40 with an empty table → PASS (the same campus needs no transition)',
  );
  it.todo(
    'GC-TRAVEL-006 (#218): an online MWF 09:00–09:50 meeting then a south MWF 09:50–10:40 meeting with an empty table → PASS (an online meeting is not subject to travel)',
  );
  it.todo(
    'GC-TRAVEL-007 (#218): north MWF 09:00–09:50, campus seed 3 MWF 10:00–10:50, south MWF 12:00–12:50; north→3 10, 3→south 60, north→south 180 → FAIL TRANSITION_TIME_INSUFFICIENT for north→south, 180 required and 130 available, though each consecutive pair passes (every pair on a shared date counts)',
  );
  it.todo(
    'GC-TRAVEL-008 (#218): north MWF 09:00–09:50 and south TTh 09:50–10:40 with an empty table → PASS (no shared active date, so no transition applies)',
  );
});

describe('golden scheduling cases: LINKED_SECTION (#219, AC06)', () => {
  it.todo(
    'GC-LINK-001 (#219): lecture 001 (MWF 09:00–09:50) requiring one of labs L01 (T 13:00–15:50) or L02 (Th 13:00–15:50) → two bundles, {001, L01} and {001, L02}',
  );
  it.todo(
    'GC-LINK-002 (#219, AC06): lecture 001 (MWF 09:00–09:50) whose only permitted lab L01 meets M 09:30–12:20 → the bundle is blocked: FAIL MEETING_CONFLICT between 001 and L01, and no bundle leaves the lab out',
  );
  it.todo(
    'GC-LINK-003 (#219, AC06): the GC-LINK-002 lecture with labs L01 (M 09:30–12:20) and L02 (Th 13:00–15:50) → one bundle, {001, L02}; the {001, L01} bundle is blocked with FAIL evidence',
  );
  it.todo(
    'GC-LINK-004 (#219, unknown): a lecture whose Lab component permits no section → UNKNOWN LINKED_SECTION_UNAVAILABLE, never a bundle without the lab',
  );
  it.todo(
    'GC-LINK-005 (#219, boundary): a 3.00-credit lecture bundled with a 1.00-credit lab whose credits are included in the lecture, term maximum 3.00 → CREDIT_LOAD PASS at 3.00 (the lab counts no credits)',
  );
  it.todo(
    'GC-LINK-006 (#219): the GC-LINK-005 bundle with a lab that counts its own credits (creditsIncludedInCourseId null), term maximum 3.00 → CREDIT_LOAD FAIL CREDIT_LIMIT_EXCEEDED at 4.00',
  );
  it.todo(
    'GC-LINK-007 (#219, #218): lecture 001 north MWF 09:00–09:50 whose only lab L01 is south M 10:00–12:50, north→south 15 → the bundle is blocked: FAIL TRANSITION_TIME_INSUFFICIENT, 15 required and 10 available',
  );
});

describe('golden scheduling cases: MEETING_TIME_UNKNOWN (#218, #220)', () => {
  it.todo(
    'GC-TBA-001 (#218, unknown): a whole-term TBA meeting vs a whole-term MWF 09:00–09:50 meeting → UNKNOWN MEETING_TIME_UNKNOWN, never PASS',
  );
  it.todo(
    'GC-TBA-002 (#218): a first-half TBA meeting vs a second-half MWF 09:00–09:50 meeting → PASS (no shared date, so the unknown time can’t conflict)',
  );
  it.todo(
    'GC-TBA-003 (#218): an online asynchronous section (no meetings) vs a whole-term MWF 09:00–09:50 meeting → PASS (nothing to conflict on time)',
  );
  it.todo(
    'GC-TBA-004 (#220, unknown): a section with a TBA meeting under a hard "no Fridays" constraint → the option is never PASS: SCHEDULE_FEASIBILITY UNKNOWN MEETING_TIME_UNKNOWN (a TBA meeting can’t satisfy hard availability)',
  );
});

describe('golden scheduling cases: HARD_VERSUS_SOFT (#220)', () => {
  it.todo(
    'GC-HARD-001 (#220): one course with MWF 09:00 and TTh 09:00 sections under a hard "no Fridays" → OPTIONS_FOUND with only the TTh option; the MWF section is never offered',
  );
  it.todo(
    'GC-HARD-002 (#220): one course with only an MWF section under a preferred "no Fridays" (rank 1) → OPTIONS_FOUND with that option, listing the unmet preference and the Friday meeting',
  );
  it.todo(
    'GC-HARD-003 (#220): two 3.00-credit courses under a hard credit maximum of 3.00 → NO_FEASIBLE_PLAN, searchComplete true, a conflictSet with isMinimal false; the hard maximum is never relaxed',
  );
  it.todo(
    'GC-HARD-004 (#220): preferences rank 1 "no Fridays" and rank 2 "not before 10:00"; option X meets rank 1 only, option Y meets rank 2 only → X ranks above Y (lexicographic, no weighted sum)',
  );
  it.todo(
    'GC-HARD-005 (#220, boundary): a hard unavailable block 00:00–10:00 on every weekday and a section meeting MWF 10:00–10:50 → OPTIONS_FOUND with that section (half-open: ending at 10:00 doesn’t touch 10:00)',
  );
});

describe('golden scheduling cases: SOLVER_OUTCOME (#220)', () => {
  it.todo(
    'GC-SOLVE-001 (#220, vertical slice): course A sections A1 MWF 09:00 and A2 TTh 09:00, course B sections B1 MWF 09:00 and B2 TTh 09:00 → OPTIONS_FOUND, complete, exactly two options {A1, B2} and {A2, B1}',
  );
  it.todo(
    'GC-SOLVE-002 (#220, AC12): two courses with one compatible bundle each, work cap 1 → SEARCH_TIMEOUT, searchComplete false, no options; never NO_FEASIBLE_PLAN',
  );
  it.todo(
    'GC-SOLVE-003 (#220, boundary): the GC-SOLVE-002 input with work cap 2 → OPTIONS_FOUND, searchComplete true, one option (a search that needs exactly the cap is complete)',
  );
  it.todo(
    'GC-SOLVE-004 (#220): courses A and B (A’s ID sorts first) with two compatible bundles each, work cap 2 → OPTIONS_FOUND, searchComplete false, one option {A1, B1}; claims neither best nor only',
  );
  it.todo(
    'GC-SOLVE-005 (#220, tie-break): the GC-SOLVE-004 input with the default cap → three distinct options in tie-break order {A1, B1}, {A1, B2}, {A2, B1}; {A2, B2} is not returned',
  );
  it.todo(
    'GC-SOLVE-006 (#220): the GC-SOLVE-005 input with sections and courses listed in reverse → a deep-equal result (input order never changes the answer)',
  );
  it.todo(
    'GC-SOLVE-007 (#220): two single-section courses both MWF 09:00–09:50 → NO_FEASIBLE_PLAN, searchComplete true, conflictSet of one MEETING_CONFLICT item, isMinimal false, omittedCount 0',
  );
  it.todo(
    'GC-SOLVE-008 (#220, unknown): a requested course with no section in the snapshot → NEEDS_VERIFICATION with SECTION_DATA_MISSING; the search doesn’t run',
  );
  it.todo(
    'GC-SOLVE-009 (#220, precedence): under a hard "no Fridays", one course whose only section meets MWF and another with no sections in the snapshot → NO_FEASIBLE_PLAN, not NEEDS_VERIFICATION (FAIL before UNKNOWN)',
  );
  it.todo(
    'GC-SOLVE-010 (#220): course A section A1 north MWF 09:00–09:50; course B sections B1 north and B2 south, both MWF 10:00–10:50; empty table → OPTIONS_FOUND with {A1, B1} (PASS) first, then {A1, B2} with SCHEDULE_FEASIBILITY UNKNOWN TRANSITION_TIME_UNDEFINED',
  );
});
