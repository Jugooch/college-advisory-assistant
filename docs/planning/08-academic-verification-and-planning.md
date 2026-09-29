# Academic verification and planning contract

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Authority and result semantics

The authoritative audit owns requirement allocation; the SIS owns official records and enrollment state; the published schedule owns sections; approved institutional rules own eligibility interpretation. Human-authorized exceptions enter through an authoritative source. Student statements can create hypothetical assumptions but cannot replace official grades or waivers.

A result is reproducible evidence about a bounded input set, not a certification that every institutional condition is satisfied.

| Check state | Meaning | Permitted presentation |
|---|---|---|
| PASS | Known applicable rule is satisfied by current evidence | “This check passed as of …” |
| FAIL | Known rule is violated | Explain reason and remediation route |
| UNKNOWN | Data, meaning, or authority is missing/conflicting | “Needs verification”; no eligible label |
| CONDITIONAL | Depends on an explicit unresolved future condition | “If you earn C or higher …”; not unconditional eligibility |

Aggregate precedence: FAIL → blocked; otherwise UNKNOWN → needs verification; otherwise CONDITIONAL → conditional plan; otherwise PASS → validated for the listed checks. If some dimensions are unknown, preserve passing dimensions instead of discarding useful evidence. Never collapse these states into a numeric confidence score.

## Separate dimensions

Requirement applicability, prerequisite eligibility, schedule feasibility, offering status, seat status, and registration readiness are different checks. A section can fit the timetable yet have unknown seat eligibility. A hold can block registration without making the course academically inapplicable. Display all relevant dimensions. “Validated plan” means only the declared academic/scheduling checks passed; it must not imply registration or degree conferral.

## Candidate formation and allocation

Obtain outstanding requirements and candidate applicability from the authoritative audit or institution-approved structured mapping. Validate a complete candidate set rather than checking each course independently: two courses can compete for a single credit bucket, and one course may be reused only within specific policies. A vendor capable only of completed-course audits may not validate planned combinations; treat that as unsupported until resolved.

Repeat, transfer, cross-listing, and credit equivalency require stable equivalency groups, attempt identities, and authoritative credit-award rules. Never count two aliases of the same course as separate credits. Use exact decimal credit values or scaled integers; do not assume every course is three credits. Preserve grade schemes; “P” is not a numeric C unless institutional policy explicitly provides equivalence for that check.

## Eligibility semantics

- Prerequisite AND/OR expressions retain structure; OR is not an ordered list of compulsory courses.
- In-progress prerequisites are conditional on the required outcome and on the institution permitting planned progression.
- Co-requisites must appear in the same qualifying period unless already satisfied or officially waived.
- Permission requirements remain UNKNOWN or blocked until evidence of permission exists.
- Minimum grades, repeated attempts, placement, cohort restrictions, and admission-to-major rules use approved source semantics.
- Pending transfer evaluations never become earned requirement credit automatically.
- Unsupported academic standing or load exceptions cause referral; the planner does not infer them.

## Schedule model

Represent each meeting with timezone, weekday recurrence, date interval, and exceptions. Check labs, recitations, exams if in scope, and linked-section groups. Two weekly meetings overlap only if both calendar intervals and meeting instances overlap. Half-open intervals permit one class ending exactly when another begins, but required travel time can still disqualify it. Unknown meeting times cannot satisfy a hard availability constraint.

Online asynchronous sections still have dates, linked activities, and enrollment restrictions. Synchronous online sections have real meetings. Credit load in overlapping short sessions must follow the institution's approved load policy rather than a naive semester sum.

## Constraint formulation

Let x_s be 1 if section s is selected. Impose at most one permitted section bundle for each planned course, required linked sections, prerequisite/corequisite conditions, duplicate-credit exclusions, and no meeting/travel conflicts. Apply credit bounds L ≤ Σ credits_s x_s ≤ U without double-counting labs included in a course's credit total. Hard user availability is also a constraint.

Optimize lexicographically: first satisfy all hard rules; then improve approved requirement progress and relevant prerequisite sequencing; then minimize soft preference penalties; then use a stable tie-breaker. Student priority ordering must be inspectable. V1 must not derive “easy courses” from demographic proxies, model guesses, or unsupported instructor ratings.

Return distinct alternatives when possible. A search timeout can return already independently validated candidates with a “search incomplete” label, but cannot assert that they are optimal or that no other options exist. An infeasibility explanation may report a verified conflict set; do not describe it as minimal unless minimality was checked.

## Evidence contract example

```json
{
  "validation_id": "val_demo_001",
  "student_snapshot_id": "student_demo_r4",
  "audit_snapshot_id": "audit_demo_r7",
  "ruleset_version": "demo-2026.1",
  "course_id": "course_demo_calc2",
  "checks": [
    {"kind": "requirement_applicability", "state": "PASS",
     "requirement_id": "demo.math.core", "source_ref": "audit_demo_r7:item12"},
    {"kind": "prerequisite", "state": "CONDITIONAL",
     "reason_code": "IN_PROGRESS_MIN_GRADE", "required_grade": "C",
     "source_ref": "rule_demo_calc1_to_calc2"},
    {"kind": "seat_eligibility", "state": "UNKNOWN",
     "reason_code": "RESERVED_SEAT_RULE_UNAVAILABLE"}
  ],
  "aggregate": "NEEDS_VERIFICATION",
  "limitations": ["Planning does not register the student"]
}
```

All identifiers above are fictional examples. The UI shows academic applicability and the prerequisite condition separately, while withholding an overall ready-to-register claim.

## Rule lifecycle

Draft mapping → static checks → academic review → adjudicated test corpus → shadow comparison → published immutable version. Record author, approver, source, affected catalog cohorts, effective date, and rollback version. Catalog publication does not retroactively move students to a new catalog. Fixes to an old cohort require explicit authority and targeted revalidation.

_Decision note (2026-09-29, ADR-0011, #139):_ For the prototype, a published ruleset version is made active per tenant by an append-only activation (`POST /v1/admin/config-releases`), which records the replaced version, the actor, the time and an external approval reference. Only the `CONFIG_RELEASER` role can activate a version. Rollback is a new activation of an earlier version. Author and approver records per version, per-cohort activation and future effective dates are deferred, and so is the check that an activator didn't author the version (planning/04). Until then, the activation's approval reference points to the external approval.

If official audit and institutional reviewer disagree, open a discrepancy and suspend the affected claim. Do not change the official audit, locally conceal the discrepancy, or promote a reviewer comment into an official waiver.
