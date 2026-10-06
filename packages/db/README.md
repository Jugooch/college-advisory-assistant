# @caa/db

Tables, row mappers, and repositories. The dev seed (`pnpm --filter @caa/db db:seed`) refuses to run in
production and is idempotent.

## Seeded section scenarios (tenant A, term 2027SP)

Expected results are derived by hand from planning/08 and planning/13, not from engine output.

| Scenario          | Sections                                                                                               | Expected result                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Vertical slice    | MATH 102 001 MWF 09:00-09:50, 002 TuTh 09:30-10:45; ENGL 101 001 MWF 09:00-09:50, 002 TuTh 09:30-10:45 | Same-pattern sections overlap, so exactly two options: MATH 001 + ENGL 002, and MATH 002 + ENGL 001.                          |
| Linked lab (AC06) | PHYS 301 001 MWF 11:00-11:50 requires lab L01 (Tu 09:30-11:20) or L02 (MW 14:00-15:15, second half)    | L01 overlaps the TuTh 09:30 lectures, so with MATH 102 002 or ENGL 101 002 only L02 fits; the lab is chosen with the lecture. |
| Half-term (AC07)  | PHYS 301 L02 (second half) and IND 390 001 (first half), both MW 14:00-15:15                           | Date ranges are disjoint, so no conflict.                                                                                     |
| Travel (AC08)     | PHYS 301 001 ends 11:50 on North; IND 390 002 starts 12:00 on South; transition table says 15 minutes  | Only 10 minutes between them, so the pair is infeasible.                                                                      |
| Unknown           | IND 390 003 has no days, times, or room                                                                | Time conflicts are UNKNOWN, never PASS; the section is not treated as conflict-free.                                          |
