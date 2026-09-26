# Security, privacy, threat model, and procurement plan

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Processing boundary

The institution controls official education records and determines the permitted basis for access. The vendor processes the minimum data needed for the contracted function. This document is a proposed engineering and review plan, not legal advice, a compliance certification, or a signed data-processing agreement.

S03 explains that outsourced service access under FERPA's school-official exception is conditional, including institutional function, direct control, use/redisclosure restrictions, and legitimate-interest conditions. Institutional counsel must determine applicability, required notices/agreements, state law, records obligations, and any special populations. Do not assume student opt-in alone resolves every obligation.

## Data flow review

Identity provider → app identity/authorization. SIS/audit/schedule → controlled ingestion → minimized academic snapshot. Snapshot → deterministic validation → student/advisor view. Selected minimal fields → approved model provider when necessary. App events → redacted monitoring. Encrypted backup → approved retention storage. Each arrow requires a documented purpose, access boundary, owner, retention, and region.

Do not send full transcripts to the model merely to explain one prerequisite. Do not ingest accommodation diagnoses, immigration documents, detailed aid records, or financial account data. A generic referral flag may be sufficient for the supported workflow if institutionally authorized.

## Threat register and mitigations

| Threat | Control | Verification |
|---|---|---|
| Student changes object ID to view another student | Server-side object authorization and tenant isolation | Negative tests across every endpoint |
| Advisor accesses unassigned students | Assignment and legitimate-purpose policy, periodic access review | Revocation and scope tests |
| Prompt injection in catalog/policy | Data/instruction separation, restricted tools, structured academic rendering | Adversarial document corpus |
| Stale or poisoned data creates false recommendation | Approved sources, integrity checks, quarantine, versioned mappings | Import corruption and stale-state tests |
| Model provider retains or trains on records | Approved terms/configuration, minimization, inventory of subprocessors | Contract and configuration evidence |
| Support engineer browses records | No standing production content access; approved time-bound access with audit | Access review and support drill |
| Secrets or PII leak through logs | Secret manager, payload suppression, redaction, scoped logging | Log sampling and scanning |
| Cross-tenant cache or queue contamination | Tenant included in cache/queue identity; reauthorize jobs | Multi-tenant fault tests |
| Compromised dependency/build | Protected branches, peer review, dependency scanning, inventory | Release evidence |
| Bulk extraction through normal APIs | Rate limits, scoped exports, anomaly monitoring | Export abuse tests |

## Baseline controls

Institutional SSO; MFA for privileged roles through the identity provider; least-privilege service accounts; read-only vendor scopes; encryption in transit and at rest; managed secrets and rotation; access/decision audit logs; tenant-aware queries and defense-in-depth database policies; vulnerability triage; incident response; restore testing; documented deletion and offboarding. Multi-tenancy must be tested even if the first pilot has only one partner, or explicitly use a dedicated single-tenant deployment while documenting that limitation.

## Incident plan

Classify academic safety incidents alongside security incidents. An incorrect recommendation can require suspension even without a data breach. On a critical incident: disable the affected capability/cohort, preserve minimized evidence, identify affected result revisions, notify the designated institutional contact under contractual timelines, correct the source/configuration, revalidate, and document recovery. Students receive institution-approved corrective communication through an authorized process; the runtime does not invent a message-send capability.

Notification deadlines are contract/jurisdiction dependent and remain to be agreed. Maintain an incident roster, escalation channel, and tabletop exercise before student launch.

## Procurement evidence checklist

Provide an accurate HECVAT response using the current institution-requested version (S05); architecture/data-flow diagram; subprocessor and region inventory; processing agreement; retention/deletion schedule; access-control model; incident plan; independent security review findings; accessibility conformance report supported by testing; insurance and business continuity information if requested; support/SLA terms; and an exit/export plan.

A HECVAT response is a disclosure tool, not certification. Do not claim SOC 2, a penetration test, accessibility conformance, or a completed legal review unless actual evidence exists. A partner may require assurance beyond startup capabilities; treat that as a commercial feasibility constraint.

## Real-record gate

Named institutional owner; approved processing terms; scoped credentials; approved source inventory; access tests; retention settings; vendor-model approval or model-free mode; incident contacts; and a controlled staging environment. If any is absent, continue with synthetic data only.
