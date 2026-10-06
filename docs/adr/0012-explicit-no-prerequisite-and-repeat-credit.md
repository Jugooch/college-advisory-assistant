# ADR-0012: Explicit "no prerequisite" rules and repeat-for-credit counting

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Tech lead
- **Related:** FR-05, FR-06, FR-09, FR-10, AC04, NFR-01, planning/08 §Eligibility semantics and §Candidate formation, planning/09 §Source authority matrix, planning/13 AC04, ADR-0010 Amendment 4, standard 08 §Required-field ripple, issues #141, #66, #267, PRs #138, #262, #268

## Context

Both decisions are about the same rule: the absence of a statement from the institution never counts as permission.

1. **Prerequisites (#141).** Course checks show `prerequisite: null` when the pinned ruleset has no rule for a course, and leave it out of the aggregate (academic-safety review of PR #138, finding 4). The rule store can't tell "the institution states this course has no prerequisite" from "this course's rule was never imported". planning/09's matrix makes missing eligibility rules UNKNOWN. PR #262 added a root-only `NONE` expression to the domain, but nothing produces or evaluates it yet.
2. **Repeat for credit (#66).** AC04 allows duplicate earned credit only when policy explicitly permits it, for example ensembles or topics courses. PR #268 added the optional `Course.repeatableForCredit` (`maxAttempts`, `maxCreditsHundredths`, each nullable), but the engine still counts one attempt per equivalency group. That's safe, but it under-counts those courses.

## Decision

### 1. "No prerequisite" is an explicit rule row; a missing row is UNKNOWN

- **Model.** A course with no prerequisite has a rule row in the ruleset whose expression is `{ "type": "NONE" }`, allowed only at the root (#262). An absent row means the rule wasn't imported. An empty `ALL` or a flag column was rejected: the domain already refuses empty groups, and a flag beside an expression could contradict it.
- **Engine semantics.**
  - `NONE` gives PASS with the rule's `sourceRef` and evidence `{ rulesetVersion, decisiveLeaves: [] }`.
  - A course with no row gives UNKNOWN with a new reason code, `PREREQUISITE_RULE_MISSING`. The engine produces that check, so the API restates no rule. It counts in the aggregate, so a set with a missing rule is never VALIDATED.
  - Linked courses (amends ADR-0010 Amendment 4): an included component is omitted from `linkedCourseResults` only when its rule is `NONE`. With no row, it's UNKNOWN `LINKED_COURSE_NOT_CHECKED`.
- **Data.** No migration: `expression` is `jsonb` parsed through the domain schema, and new rows are inserts. The seed writes `NONE` for every seeded course without a prerequisite. A future rule importer writes `NONE` only when the source states it, `UNSUPPORTED` when it can't parse the rule, and never relies on a missing row.
- **Contract.** `CourseCheckResult.prerequisite` stays nullable for now. The API stops sending `null`. Making it non-nullable is a later domain and web change.

### 2. Repeat-for-credit counting

`repeatableForCredit: null` keeps today's rule: the repeat policy picks one counting attempt per equivalency group. A non-null statement changes the group's counting as follows.

- **When it applies.** A group is repeatable when every course in it states the same non-null `repeatableForCredit`. If the courses of a group with two or more countable attempts state different values, the group is UNDETERMINED `REPEAT_POLICY_UNDEFINED`. The catalog conflicts, so nothing is guessed.
- **Which attempts count.** COMPLETED and TRANSFER_AWARDED attempts that earned more than 0 credits, in term order (term calendar `sequence`). An attempt that earned 0 doesn't use up `maxAttempts`. IN_PROGRESS and TRANSFER_PENDING attempts earn nothing, as today.
- **Caps.** At most `maxAttempts` attempts count, the earliest first. Earned credit is the sum of the counted attempts' `creditsEarnedHundredths`, capped at `maxCreditsHundredths`. A `null` cap means no cap is stated.
- **Order only matters when a cap binds.** If a cap binds and the cut falls between attempts whose order can't be settled (a term missing from the calendar, or one term with attempts of different credits), the group is UNDETERMINED `REPEAT_ORDER_UNDETERMINED`. Ties of equal credit are broken by attempt ID, which changes only the evidence and never the total.
- **Unknown credit.** If any counted attempt has `creditsEarnedHundredths: null`, earned credit is `null`.
- **Prerequisite leaves.** For a repeatable course the repeat policy isn't consulted, because attempts don't replace each other. A `COURSE` leaf combines the counted attempts' outcomes with the existing `ANY` logic, so one attempt that meets the minimum grade is enough.
- **Data.** Three `course` columns (a `repeatable_for_credit` flag, default `false`, and the two nullable caps), with checks that the caps are null unless the flag is set. `false` maps to `null`.

This interprets planning/08 and AC04; it doesn't change them, so it needs no change-control record.

### Follow-up issues, in dependency order

#141:

1. #354 (domain-engineer): the `PREREQUISITE_RULE_MISSING` reason code, with the wording-map ripple.
2. #355 (engine-engineer): `NONE` is PASS, the missing-rule check, and `NONE` in linked-course selection. #356 (data-engineer): `coursesIn` accepts `NONE`. #357 (api-engineer): seed-based tests stop asserting that a seeded course has no rule. All three run in parallel.
3. #358 (domain-engineer): widen `PrerequisiteRule.expression`, after #355 and #356.
4. #359 (data-engineer): seed `NONE` rules, after #357 and #358.
5. #360 (qa-engineer): golden cases, and re-adjudicated acceptance tests registered as known findings, after #355 and #358.
6. #361 (engine-engineer): an included linked course with no row is UNKNOWN. #362 (api-engineer): a missing rule is UNKNOWN in course checks and schedule options. Both after #359 and #360, and each removes its own known findings.

#66:

1. #363 (data-engineer): the columns, mapper and seed. #364 (qa-engineer): builder default, fixtures and repeatable fixture courses. In parallel.
2. #267 (domain-engineer): make `repeatableForCredit` required.
3. #365 (engine-engineer): the counting rule above, after #267. #366 (qa-engineer): the golden family and AC04 cases, in parallel after #364, as known findings until #365 merges.

## Consequences

- A missing or unimported rule can no longer leave a course set VALIDATED. Every seeded course needs a rule row, and so will every imported one.
- Courses repeatable for credit count correctly within the institution's caps; every other repeat still earns credit once.
- The rollout takes 13 single-owner PRs. Each keeps `main` green, and acceptance tests that change meaning go through the known-findings register first.
- A new reason code adds one frontend-authored wording entry.

## Revisit when

- A real rule importer is built: confirm it writes `NONE` and `UNSUPPORTED` as above.
- An institution's repeat rules depend on more than attempt and credit caps (for example a different topic per attempt), which this model can't express.
- Progress or degree-credit totals start reading earned credit, and a capped repeat needs to show which attempts were excluded.
