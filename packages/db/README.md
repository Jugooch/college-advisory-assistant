# @caa/db

Tables, row mappers, and repositories. The dev seed (`pnpm --filter @caa/db db:seed`) refuses to run in
production and is idempotent.

## Prerequisite rules

The seed writes exactly one rule per seeded course in the seeded ruleset: a real prerequisite, or an
explicit `NONE` rule (linked labs included). A course with no rule row is UNKNOWN, never "none".
No rule importer exists yet. When one is added it must write `NONE` when the source states no
prerequisite, write `UNSUPPORTED` when it can't parse the rule, and never leave a course without a
row to mean "none".

## Seeded section scenarios (tenant A, term 2027SP)

Expected results are derived by hand from planning/08 and planning/13, not from engine output.

| Scenario          | Sections                                                                                               | Expected result                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertical slice    | MATH 102 001 MWF 09:00-09:50, 002 TuTh 09:30-10:45; ENGL 101 001 MWF 09:00-09:50, 002 TuTh 09:30-10:45 | Same-pattern sections overlap, so with these four sections exactly two options: MATH 001 + ENGL 002, and MATH 002 + ENGL 001. ENGL 101 003 (below) adds MATH 001 + ENGL 003 and MATH 002 + ENGL 003, so the seed gives four. |
| Linked lab (AC06) | PHYS 301 001 MWF 11:00-11:50 requires lab L01 (Tu 09:30-11:20) or L02 (MW 14:00-15:15, second half)    | L01 overlaps the TuTh 09:30 lectures, so with MATH 102 002 or ENGL 101 002 only L02 fits; the lab is chosen with the lecture.                                                                                                |
| Half-term (AC07)  | PHYS 301 L02 (second half) and IND 390 001 (first half), both MW 14:00-15:15                           | Date ranges are disjoint, so no conflict.                                                                                                                                                                                    |
| Travel (AC08)     | PHYS 301 001 ends 11:50 on North; IND 390 002 starts 12:00 on South; transition table says 15 minutes  | Only 10 minutes between them, so the pair is infeasible.                                                                                                                                                                     |
| Unknown           | IND 390 003 has no days, times, or room                                                                | Time conflicts are UNKNOWN, never PASS; the section is not treated as conflict-free.                                                                                                                                         |
| No Fridays (AC48) | ENGL 101 003 TuTh 11:00-12:15 and PHYS 301 002 TuTh 13:00-14:15 (lab L02 only), North                  | MATH 102 002 + ENGL 101 003 + PHYS 301 002 + L02 + IND 390 001 (2.00) is Friday-free and reaches 12.00 credits.                                                                                                              |

## Demo: save a draft, make its source stale, create an advisor case

All data is synthetic. Run from the repository root with `DATABASE_URL` set; both commands refuse to
run when `NODE_ENV=production`.

`pnpm --filter @caa/db db:seed:demo` seeds the dev data plus three synthetic personas (SYN-000004 blocked prerequisite, SYN-000005 UNKNOWN data, SYN-000006 stale plan), all assigned to `synthetic-advisor-001`; it writes no plan, check result or case (ADR-0016).

1. `pnpm --filter @caa/db db:seed` seeds the slice student (`synthetic-student-001`, SYN-000001),
   the assigned advisor (`synthetic-advisor-001`), the admin, and a second advisor
   (`synthetic-advisor-002`) who has no assignment and therefore sees no student.
2. Sign in as the student and save a plan draft for 2027SP.
3. Supersede one of its sources:
   - `pnpm --filter @caa/db db:seed:revise` (or `--student`) publishes a newer student record in
     which the in-progress DEMO-PHYS 201 attempt becomes completed with a posted grade. The draft is
     `STALE` with `STUDENT_RECORD_SUPERSEDED`.
   - `pnpm --filter @caa/db db:seed:revise --student SYN-0000NN` does the same for another seeded
     student (a demo persona or another dev seed student): their record gains a completed
     DEMO-PHYS 201 attempt. An ID outside the seed fails and writes nothing.
   - `pnpm --filter @caa/db db:seed:revise --sections` publishes a newer 2027SP section snapshot
     in which DEMO-MATH 102 section 002 is withdrawn. The draft is `STALE` with
     `SECTIONS_SUPERSEDED`.
4. Sign in as the student and create an advisor case from the stale draft.
5. Sign in as `synthetic-advisor-001` and see the case; sign in as `synthetic-advisor-002` and see
   nothing.

Each run appends a revision taking effect at the run time, so running it again makes another newer
revision and earlier snapshots are never changed. A run at or before the latest revision's time is
refused, so a late older batch never replaces newer truth. Run `db:seed` first; the command only
reads and writes this system's own synthetic data, never an institutional system.

`pnpm --filter @caa/db db:reset` drops every table and the migration journal, recreates the schema,
and migrates. It refuses, before connecting, unless the `DATABASE_URL` host is `localhost` or
`127.0.0.1` and `NODE_ENV` is not `production`, and it says which check failed.
