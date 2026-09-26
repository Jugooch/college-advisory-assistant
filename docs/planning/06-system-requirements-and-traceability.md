# System requirements and traceability

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Interpretation

SHALL statements are proposed acceptance requirements. Must requirements block student pilot release. Values are design targets to be validated with the partner; they are not measured service performance or contractual SLAs. The test strategy defines named test families referenced below.

| ID | Requirement | Priority | Primary verification |
|---|---|---|---|
| FR-01 | Authenticate through approved institutional SSO and derive tenant/user context on the server | Must | T01 identity and isolation |
| FR-02 | Authorize every student object read and write using role, assignment, and tenant | Must | T01 |
| FR-03 | Import records idempotently with source identity, version, effective time, and ingestion time | Must | T02 ingestion |
| FR-04 | Qualify program, catalog cohort, and policy coverage before personalized planning | Must | T03 scope and audits |
| FR-05 | Preserve authoritative requirement allocation, approved exceptions, and ambiguous states | Must | T03 |
| FR-06 | Validate prerequisites, corequisites, repeats, exclusions, credit limits, and relevant restrictions | Must | T04 academic constraints |
| FR-07 | Validate actual section meetings, linked sections, term overlaps, and configured travel time | Must | T05 scheduling |
| FR-08 | Capture hard constraints separately from soft preferences and confirm interpretation | Must | T05, T08 usability |
| FR-09 | Return PASS, FAIL, UNKNOWN, or CONDITIONAL per check with evidence | Must | T04 |
| FR-10 | Render consequential academic assertions only from approved structured result fields | Must | T06 AI controls |
| FR-11 | Save versioned plans and mark dependencies stale before reuse when inputs change | Must | T07 lifecycle |
| FR-12 | Provide an authorized case queue with ownership, reason, status, and audit trail | Must | T07 |
| FR-13 | Support cohort disablement and rollback of adapter/rule releases | Must | T09 operations |
| FR-14 | Log access and consequential decisions without recording unneeded raw student content | Must | T01, T09 |
| FR-15 | Prevent all institutional academic writes in V1 at credentials and network boundaries | Must | T01 |
| FR-16 | Search only approved tenant-scoped policy content with applicable dates | Must | T06 |
| FR-17 | Let students report source discrepancies without mutating authoritative records | Must | T07 |
| FR-18 | Compare up to three validated schedule options and explain unmet soft preferences | Should | T05, T08 |
| NFR-01 | Produce identical validation results for identical pinned inputs and engine versions | Must | T04 replay |
| NFR-02 | Meet WCAG 2.2 AA as the product target across complete core workflows | Must | T08 manual/automated accessibility |
| NFR-03 | Encrypt network transport and stored records; manage secrets outside code and logs | Must | T01 review |
| NFR-04 | Suppress applicable claims when their source freshness policy is exceeded | Must | T02, T04 |
| NFR-05 | Keep non-LLM planning and evidence usable during model outages | Must | T09 fault injection |
| NFR-06 | Complete interactive reads at p95 ≤2 seconds and planning at p95 ≤10 seconds under agreed pilot load | Target | T10 load; external wait measured separately |
| NFR-07 | Stop solver search after a configured 15-second budget and distinguish timeout from infeasibility | Must | T05, T10 |
| NFR-08 | Support retention, institutional export, deletion, and backup expiry processes | Must | T09 lifecycle drill |
| NFR-09 | Achieve 99.5% monthly app availability during the pilot, measured independently of source freshness | Target | T09 monitoring |
| NFR-10 | Target restoration within 8 hours and ≤24 hours data loss for app-owned state | Target | T09 restore drill |

## Traceability from business goals

| Goal | Requirements | Main risks | Release evidence |
|---|---|---|---|
| Academically defensible recommendations | FR-04–10, NFR-01,04 | R01,R02,R03,R06 | Adjudicated corpus, allocation evidence, unknown-state tests |
| Reduce planning friction | FR-08,11,12,18, NFR-02,06 | R05,R08 | Observed task study and advisor time baseline |
| Protect education records | FR-01,02,14,15, NFR-03,08 | R04,R10 | Access tests, processing agreement, retention drill |
| Operate safely through change | FR-03,11,13, NFR-05,07,09,10 | R02,R07,R09 | Replay, fault tests, rollback and restore evidence |

## Definition of ready for an implementation story

A story has a supported cohort, source authority, failure states, requirement IDs, acceptance examples, authorization rules, and reviewer. Missing source semantics are a blocker for consequential features, not a license for the LLM to fill gaps.

## Definition of done

Implementation and peer review complete; applicable tests pass; independent academic review completed when meaning changes; accessibility and privacy impact reviewed; telemetry and rollback documented; user-facing wording reflects uncertainty; traceability updated. A passing happy-path demo is insufficient.
