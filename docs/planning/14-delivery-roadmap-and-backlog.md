# Delivery roadmap, backlog, and stage gates

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Sequence and exit criteria

| Stage | Work | Exit evidence | Stop condition |
|---|---|---|---|
| G0 Discovery | Interviews, incumbent review, source samples, budget/sponsor identification | Verified problem and feasible bounded integration | No partner or data authority |
| G1 Synthetic proof | One complete planning flow with fictional students | Traceable results and independent academic review | Required semantics cannot be represented |
| G2 Integration qualification | Approved feeds, mapping, SSO, privacy/security controls | Reconciled snapshots and signed coverage matrix | Unsupported hypothetical audit/allocation |
| G3 Advisor shadow | Real-record outputs visible only to authorized reviewers | Adjudicated disagreements and regression corpus | Unresolved critical error |
| G4 Controlled student pilot | Small cohort, staffed queue, monitoring, kill switch | Correctness/coverage/usability/cost report | Safety, access, or support failure |
| G5 Expansion decision | Evaluate outcomes and new cohort effort | Sponsor decision and explicit new qualification scope | Value insufficient or maintenance uneconomic |

There is no automatic progression based on elapsed weeks. Institution procurement and data readiness may delay or end the project independently of engineering progress.

## Prioritized implementation backlog

| Epic | First slices | Dependencies | Acceptance anchor |
|---|---|---|---|
| E01 Discovery and authority | Source inventory; redacted sample; assignment model | Partner access | G0 |
| E02 Canonical ingestion | Course/term feed; student/audit feed; atomic publication | E01 | FR-03, T02 |
| E03 Identity and access | Student SSO; advisor assignment; negative access tests | E01 | FR-01,02 |
| E04 Academic verification | One program/catalog; applicability; prerequisites; unknown states | E02 | FR-04–06,09 |
| E05 Scheduling | Linked sections; meeting conflicts; preferences; bounded solver | E04 | FR-07,08,18 |
| E06 Student UX | Overview; constraint form; cards; evidence; stale state | E03–05 | FR-10,11; T08 |
| E07 Conversation | Intent extraction; approved tools; deterministic claim rendering | E04,06 | T06 |
| E08 Advisor workflow | Case creation; assignment; review; discrepancy path | E03,06 | FR-12,17 |
| E09 Operations/security | Logs; feed health; retention; rollback; restore | Cross-cutting from start | FR-13–15, NFR-03,08 |
| E10 Evaluation/pilot | Golden corpus; shadow comparison; task studies; pilot report | All relevant epics | G3/G4 |

## First vertical slice

Use fictional student A in fictional program P under one catalog version, a completed prerequisite, one remaining requirement, and four published fictional sections including a conflict. Produce two feasible options and evidence; then alter the grade to fail and show the blocked result; then remove a source field and show UNKNOWN. Save a draft, make its source stale, and create an advisor case. This exercises the trust boundary before a broad UI or model integration.

## Critical path

Audit semantics and permissions → consistent source mapping → independent academic validation → usable reviewed workflow → institutional launch approvals. Model prompt tuning is not on the critical path until the underlying services are dependable.

## Estimation method

After the source spike, estimate work by adapter uncertainty, number of rule families, supported cohorts, number of screens/states, security requirements, and available institutional review hours. Separate engineering effort from partner wait time. Track integration setup hours per institution as a commercial risk metric.

No binding dates or budget are selected. Reassess the proposal's rough duration ranges at G0 and G2. Do not commit to a term's registration deadline without a schedule buffer and a fallback service.

## Handoff to implementation

Each epic needs a named owner, approved requirement subset, example data, acceptance cases, and a rollout/rollback plan. Use repository issues once a repository is selected. This package creates documentation only and does not create a repository, deploy software, or change institutional systems.
