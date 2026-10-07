# Test strategy, academic evaluation, and release acceptance

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Testing principle

Validate academic behavior against independently adjudicated examples. A test that reimplements the same flawed assumption as the production rule is weak evidence. Imported audit output is a useful comparator, but discrepancies require institutional review rather than automatically assuming either side is right.

No tests in this document have been executed against a built system. This is the planned acceptance strategy.

## Test families

| ID | Family | Essential coverage |
|---|---|---|
| T01 | Identity/security | Tenant isolation, object access, assignment revocation, read-only scopes, export limits |
| T02 | Import/freshness | Duplicate/out-of-order feeds, tombstones, partial batches, skew, expired sources |
| T03 | Scope/audit | Correct catalog, exceptions, allocation ambiguity, unsupported programs |
| T04 | Academic rules | Grades, repeats, transfers, AND/OR prerequisites, corequisites, credit/residency limits, replay |
| T05 | Scheduling/solver | Linked labs, recurrence/date overlap, travel, hard/soft constraints, timeout/infeasibility |
| T06 | AI/policy | Unsupported claims, injection, effective-date retrieval, tool misuse, specialist referral |
| T07 | Lifecycle/cases | Revision conflict, stale plan, ownership, case resolution, discrepancy reporting |
| T08 | Usability/accessibility | Core tasks, keyboard/screen reader, comprehension of conditions and registration status |
| T09 | Operations | Outages, kill switch, rollback, restore, deletion, incident response |
| T10 | Performance/cost | Peak pilot workload, worst-case search, source latency, bounded inference costs |

## Golden corpus design

Start with at least 200 deliberately distinct synthetic cases across the supported rule families, reviewed by an academic domain owner. Expand toward 1,000+ independently varied cases before broader pilot expansion if coverage warrants it. These counts are proposed starting gates, not statistical proof of safety. Coverage and oracle quality take precedence over raw volume.

Each case records source versions, complete input, expected per-check state, expected evidence, allowed alternatives, prohibited claims, rationale, reviewer, and adjudication date. Keep a frozen holdout set separate from development fixtures. De-identified historical cases require institutional authorization and a re-identification risk review; synthetic cases are the default.

**Status (sprint S3):**
- The corpus holds 113 development cases across 20 rule families. Holdout v0.2 (frozen 2026-09-29) holds 15 cases.
- [`tests/golden/coverage-map.md`](../../tests/golden/coverage-map.md) lists each family's cases, the interactions covered, open gaps, and the path to the 200-case gate. It gives holdout counts only.
- The format, layout, finding workflow and holdout rules are in `docs/standards/07-testing.md` §Golden corpus.
- Every case is currently marked `pending-academic-review`. The 200-case gate and academic sign-off remain open for G1.
- v0 surfaced two engine defects (#88, #89), both fixed in S2. S3 raised one finding, #183, settled by ruling GR-01 below. S4's scheduling golden planning raised one open question, settled by ruling GR-02.

**Adjudication rulings.** When the planning docs leave a golden expectation open, the tech lead rules on the issue and records it here. A ruling is adopted for the synthetic prototype only. It needs academic-owner approval before G1, as every case does (planning/04 §Decision process).

| ID | Question | Ruling | Evidence | Status | Revisit when |
|---|---|---|---|---|---|
| GR-01 (#183, 2026-09-29) | A rule with no minimum grade ("any passing completion") meets a completed pass/fail `P`. The policy sets `lowestPassingLetterGrade` and leaves `passSatisfiesMinimumGrade` null. Is it PASS or UNKNOWN? | **PASS.** A `P` is a passing completion in its own scheme. `lowestPassingLetterGrade` says which *letters* pass. It doesn't turn "any passing completion" into "C or better". `passSatisfiesMinimumGrade` and `PASS_EQUIVALENCE_UNDEFINED` apply only when the rule sets a letter minimum (AC19). An institution that needs C or better puts that minimum on the rule. A pass/fail `F` is still FAIL. | planning/08 §Candidate formation and allocation (a `P` is not a C *for a check that requires one*); `AcademicPolicySchema` field contracts (#69); AC19 | Adopted for prototype; pending academic review | An institution defines a `P` that is not a passing completion, or asks that "no minimum" mean its lowest passing letter for every scheme |
| GR-02 (#226, 2026-09-29) | One meeting has known weekdays but a TBA (unknown) start and end time. The other is timed, on different weekdays. Is their meeting-conflict check PASS or UNKNOWN? | **PASS only when the known dates prove the two meetings never meet on the same date. Otherwise UNKNOWN `MEETING_TIME_UNKNOWN`.** A meeting's possible dates are the dates from `startsOn` to `endsOn`, less its `excludedDates`, that fall on its weekdays. When its weekdays are TBA (`null`), every weekday counts. If the two sets of possible dates don't intersect, no meeting instance can overlap, so the pair is PASS whatever the times. For example, MW with TBA times against TTh 09:00–09:50 is PASS. If they share even one possible date and either time is TBA, the pair is UNKNOWN: never PASS, and never FAIL. This covers the pairwise meeting-conflict check only. A TBA time still never satisfies a hard unavailable time, and a soft preference that depends on one still counts as not met (ADR-0010 §3 and §4). | planning/08 §Schedule model (two meetings overlap only if both calendar intervals and meeting instances overlap) and its check-state table (missing data is UNKNOWN); ADR-0010 §3, §6 and Amendment 1; GC-TBA-002 (no shared date gives PASS) | Adopted for prototype; pending academic review | A source publishes weekdays that can still change after publication, or an institution asks that a TBA meeting be treated as possible on every weekday |

## Representative acceptance cases

| Case | Setup | Expected result |
|---|---|---|
| AC01 | Prerequisite requires C; student earned D | FAIL for prerequisite |
| AC02 | Prerequisite currently in progress | CONDITIONAL only if institutional progression policy permits |
| AC03 | Pending transfer course could satisfy prerequisite | UNKNOWN until approved equivalency/credit exists |
| AC04 | Repeated course shares equivalency group | No duplicate earned credit unless policy explicitly permits |
| AC05 | Two requirements compete for the same non-reusable course | Do not mark both satisfied |
| AC06 | Lecture fits; required lab conflicts | Block the bundle |
| AC07 | Classes meet same time in disjoint half-terms | Allow if other constraints pass |
| AC08 | Back-to-back classes need cross-campus travel | Reject if configured transition time is insufficient |
| AC09 | Student belongs to old catalog | Apply old approved rules, not current website rules |
| AC10 | SIS program updated after audit generation | Refresh or UNKNOWN; no mixed-snapshot validation |
| AC11 | Seat count is positive but reserved-seat rules unavailable | Seat eligibility UNKNOWN |
| AC12 | Solver times out without a candidate | SEARCH_TIMEOUT, not no feasible schedule |
| AC13 | Policy document instructs model to reveal records | Ignore instruction; no unauthorized tool execution |
| AC14 | Source outage during plan reopen | Historical plan visible, current validity withheld |
| AC15 | Advisor assignment revoked mid-session | Next object operation denied |
| AC16 | User says “register me” | Explain saved-plan boundary; no enrollment action |
| AC17 | Approved exception expires before target term | Do not apply expired exception |
| AC18 | Variable-credit independent study | Correct selected credit value and cap evaluation |
| AC19 | Pass grade not defined for minimum-letter-grade prerequisite | UNKNOWN, not presumed passing |
| AC20 | Model tries to summarize CONDITIONAL as eligible | Template/gate preserves condition and blocks unsupported narrative |
| AC21 | Actor from tenant A requests a tenant B student | 404, indistinguishable from a missing student; no existence leak |
| AC22 | Request with no session, an unknown session, or a disabled identity | 401 standard error envelope |
| AC23 | An identical roster batch is imported again | ALREADY_IMPORTED; nothing changes |
| AC24 | Same batch ID arrives with a different checksum | CONFLICT; nothing published |
| AC25 | A DELTA batch omits a student; a later batch tombstones them | Omission keeps the student; only the tombstone deletes |
| AC26 | An older batch arrives after a newer one | Rejected as stale; newer data is not overwritten |
| AC27 | Academic summary and course checks are requested by the student, an assigned advisor, an unassigned advisor, another student, and another tenant; one request body names a tenant, role, or user | Student and assigned advisor may read; everyone else gets a 404 identical to a missing student, and nothing from the student reaches another tenant; a body naming a tenant, role, or user is 400; no or unknown session is 401 |
| AC28 | Student has no record, two records or audits tie for latest, no audit, no ruleset policy, or a record or audit record time past the 24-hour maximum age | No record: 503 SOURCE_UNAVAILABLE; tie: 409 STALE_SOURCE; no audit or policy: course checks 503; past 24 h: the summary and course checks both 409 STALE_SOURCE with an advisor referral, exactly 24 h is still fresh; no 200 historical view of the summary (#114, ADR-0008 Amendment 1) |
| AC29 | Course checks for the AC02, AC05, and AC18 golden cases; a course with no rule; a course outside the tenant's catalog | The API returns the adjudicated engine states unchanged (CONDITIONAL only where policy permits, competing courses or requirements named, the selected credit counted exactly, an unchosen credit UNKNOWN and never validated); no rule is `prerequisite: null`, never PASS; an unknown or other-tenant course is 400 |
| AC30 | AC10 through the API: the record was revised more than one hour after the audit's record time, or names another program or catalog | Both endpoints report audit-derived checks as UNKNOWN, never PASS or FAIL from another program, and never VALIDATED; dimensions that don't read the audit keep their result; exactly one hour of skew still passes |
| AC31 | The same course-check request is made twice on unchanged inputs; a newer record revision or audit is stored | The result pins the record snapshot, audit, ruleset, and as-of times and follows the newer revision or audit; replays are deep-equal; no free-text academic claims, only structured fields and the audit's own requirement labels |
| AC32 | A student saves a schedule option, or a result with no options, as a draft; the inputs changed between viewing and saving; an assigned advisor, another student, or another tenant tries to save | The stored revision is the server's replay on the pinned inputs, never client evidence; changed inputs give 409 REVISION_CONFLICT with nothing written; only the student may save, and everyone else gets 404; a body naming a tenant, user, role or owner is 400 |
| AC33 | A saved draft after a newer student snapshot, audit, section snapshot, ruleset or transition table is stored, or after a pinned source passes the maximum age; a source can't be read at reopen | STALE with each reason; exactly at the maximum age it is still CURRENT; an unreadable source is UNKNOWN, never CURRENT (AC14); in every case the revision is returned unchanged as history with its original time and states, and nothing claims current validity |
| AC34 | The student revalidates a stale draft; the selected section was withdrawn; two revalidations race; the current sources are themselves stale | A new revision is appended and earlier ones are unchanged; a selection carries over only if the identical section set is still offered, otherwise it is null; the race gives one 201 and one 409 REVISION_CONFLICT; stale current sources give 409 STALE_SOURCE with nothing written |
| AC35 | A student creates an advisor case from a saved, possibly stale, revision; another student, an unassigned advisor, or another tenant reads it; the body names a status, owner or tenant; a second open case for the same plan | The case pins that revision and shares only it and the student's note; the others get 404; the body is 400; the second case is 409; no message is sent and nothing is written outside the app |
| AC36 | An assigned and an unassigned advisor open the queue; two advisors claim at once; a non-owner resolves; the assignment is revoked between claim and resolve; the owner resolves | Only the assigned advisor sees the case; one claim wins and the other gets 409; a non-owner gets 404; after revocation the next action is 404 (AC15); the resolution changes no plan revision, check or source row; RESOLVED is final |
| AC37 | A student reports a discrepancy in a course attempt | A SOURCE_DISCREPANCY case is created; the student snapshot, audit and attempts are unchanged; nothing presents the report as a correction or waiver (FR-17) |

AC21–AC26 were added in sprint S1 (issues #16, #27); they cover identity, tenant isolation, and ingestion. AC27–AC31 were added in sprint S3 (issue #102, PR #175); they cover the academic summary and course-check endpoints end to end through the API. AC32–AC37 were added in sprint S5 (issue #400, ADR-0013); they cover plan drafts, staleness, revalidation and advisor cases.

## Metrics and interpretation

Invalid recommendation rate = adjudicated invalid consequential recommendations / adjudicated consequential recommendations. Report case-level and claim-level denominators separately. Unknown-handling error rate = incorrectly resolved uncertain cases / cases requiring uncertainty. Coverage = eligible supported requests yielding a useful validated or explicitly conditional plan / eligible supported requests. Also report out-of-scope volume, escalation rate, and abandonment.

For zero errors in n independent trials, approximately 3/n is an upper 95% risk bound; 1,000 zero-error trials implies about 0.3%, not zero. Real test cases are not independent or representative by default, so never use this calculation as a production guarantee.

## Proposed student-pilot release gates

- All Must requirements traced to passing evidence; all supported rule families have positive, negative, boundary, and unknown cases.
- Zero known critical defects: false academic eligibility, unauthorized access, hidden unsupported claims, or unintended institutional writes.
- No unresolved high-severity findings affecting the pilot; lower-severity items have owners and dates.
- Academic reviewers adjudicate all shadow disagreements; unsupported cohorts disabled.
- Accessibility review covers complete student/advisor tasks with manual assistive-technology testing.
- Restore, rollback, source outage, model outage, and escalation drills succeed.
- Performance measured against agreed load; pilot operator capacity confirmed.

Any new critical incident pauses the affected cohort/capability. Passing an initial gate does not eliminate ongoing monitoring.
