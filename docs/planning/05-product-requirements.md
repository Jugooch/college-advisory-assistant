# Product requirements document

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Personas and jobs

Student: “Help me identify courses that advance my degree and fit my next term, and explain any uncertainty.” Advisor: “Show me the record, reasoning, and unresolved issue before I intervene.” Registrar: “Preserve approved rules and make disagreements discoverable.” IT administrator: “Integrate with bounded access and predictable failure behavior.” Program administrator: “Maintain supported coverage without accidental expansion.”

V1 is not a general career counselor, crisis service, financial-aid calculator, immigration advisor, or registrar replacement.

## Scope and priority

| Capability | Priority | V1 interpretation |
|---|---|---|
| SSO and scoped access | Must | One institutional identity integration; assignments enforced server-side |
| Student record and audit view | Must | Exact program/catalog and source timestamp, unsupported state visible |
| Requirements explanation | Must | Structured audit evidence; policy links for general explanations |
| Next-term course/section planning | Must | Qualified programs and published term only |
| Preferences | Must | Credit range, unavailable time, modality/campus constraints; explicit hard vs soft |
| Evidence and validation states | Must | Visible for every consequential option |
| Save and revise plan | Must | Immutable revision history with revalidation |
| Advisor escalation | Must | Owned queue, case status, evidence, manual resolution |
| Approved policy search | Must | Tenant-scoped, effective-date-aware corpus |
| Operational administration | Must | Feed health, rule versions, cohort eligibility, rollback |
| Alternative schedule comparison | Should | Up to three valid distinct options with explicit tradeoffs |
| Critical-path hints | Should | Only from approved dependency graph; no guaranteed graduation date |
| Advisor-reviewed export | Should | Accessible student-readable summary; no transcript-wide export by default |
| Multi-year graduation optimization | Later | Future offerings and scenario assumptions need separate model |
| Major changes, dual degrees, prospective transfer | Later | Require broader authoritative hypothetical audits |
| Registration writes or SIS case writeback | Excluded | New permission and transaction design needed |
| Predictive risk scoring, LMS surveillance | Excluded | No need for the initial planning job |
| Automated email/SMS campaigns | Excluded | Manual handoff inside the app only |

## Main student journey

1. Sign in through the institution and see whether the program/catalog is supported.
2. Review imported program, term, record timestamp, and audit status. Report discrepancies without editing official fields.
3. State preferences through a form or chat. Review structured constraints before they become hard exclusions.
4. Request next-term options. The server validates candidate allocations and schedules against a pinned data snapshot.
5. Compare a small set of alternatives, including unmet preferences and pending conditions.
6. Save a draft and optionally submit an advisor case. A plan is never labeled registered.
7. Reopen later; if dependent data changed or freshness expired, view the historical plan and revalidate before reuse.

## Key stories with acceptance

| Story | Acceptance |
|---|---|
| As a student, I want to know why a course is suggested | Requirement link, minimum grade, credit contribution, and evidence revision are visible |
| As a student, I want Fridays free | User can make this a hard constraint or preference; planner never silently changes it |
| As a transfer student, I want pending credit considered | Pending credit is not counted as earned; affected eligibility is conditional or unknown |
| As an advisor, I want to see why a plan is blocked | Case includes failing checks, unknown checks, snapshot IDs, and student-approved context |
| As a registrar, I want a changed policy tested | Release displays changed mappings, impacted cases, regression result, and named approval |
| As a student with assistive technology, I want to revise a plan | Entire task works without dragging, color distinctions, or chat-only controls |

## Completion and failure UX

Return no more certainty than the data supports. “No valid schedule found” must distinguish a proven infeasible constraint set from a timeout or missing data. Offer to relax soft preferences, not academic rules. When a required service fails, preserve prior drafts with their historical timestamp and provide a human route.

A student outside the qualified scope may read approved general guidance and contact an advisor, but does not receive personalized validated schedules. Explain which coverage is missing without implying the student's record is erroneous.

## Product measures

Primary: invalid consequential recommendation rate on adjudicated supported cases; unsupported-claim rate; correct handling of unknowns. Pair these with coverage: supported eligible requests resolved without an advisor. A system that refuses everything is safe-looking but not useful.

Secondary: task completion, time to a reviewed plan, advisor review minutes per resolved case, student comprehension of conditions, accessibility defects, escalation backlog, per-resolved-request cost. Satisfaction is informative but cannot override correctness.
