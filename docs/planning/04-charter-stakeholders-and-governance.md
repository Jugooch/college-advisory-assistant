# Project charter, stakeholders, and governance

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Charter

Problem: students and advisors spend time reconciling academic requirements with records and real schedules. Objective: provide auditable next-term planning assistance while preserving institutional authority. Sponsor, partner institution, budget ceiling, named team members, contractual commitments, and launch date remain unassigned.

The project is successful only if supported recommendations are independently validated, unknowns are visible, students can understand the result, and institutional reviewers accept the workflow. A polished chatbot with weak source data is not completion.

## Accountability matrix

Roles may be combined in a small company, but rule authors must not self-approve production academic policy changes.

| Work or decision | Accountable role | Responsible role | Consulted |
|---|---|---|---|
| Scope and investment | Product sponsor | Product lead | Institutional sponsor, engineering |
| Curriculum mappings and audit disputes | Registrar/curriculum owner | Academic domain lead | Advisors, engineering |
| Integration identity and feeds | Institutional IT owner | Integration engineer | Registrar, security |
| Architecture and release engineering | Technical lead | Engineering | Security, academic lead |
| Education-record processing basis | Institutional privacy/legal owner | Privacy lead | Vendor counsel, registrar |
| Access assignments | Institutional access owner | Identity administrator | Advising manager |
| Student workflow and usability | Product lead | Designer | Students, accessibility lead |
| Accessibility acceptance | Institutional accessibility owner | Accessibility tester | Engineering |
| Pilot operations and escalations | Advising manager | Assigned advisor team | Support, product |
| Go-live | Institutional sponsor | Product/technical leads | Required academic, security, privacy, accessibility reviewers |

## Decision process

Record a decision ID, options, evidence, owner, status, date, consequences, and review trigger. Proposed does not mean approved. Academic interpretation is escalated to the institution; engineering never settles conflicting policy by choosing whichever result is easier to implement.

Weekly working review covers blocked cases, data quality, correctness failures, risk changes, and scope. Gate reviews occur before using real records, before student exposure, and before cohort expansion. Emergency rollback can be initiated by the incident lead without waiting for the weekly meeting.

## Change control

A change request states the user problem, affected requirements, data classes, adapter/rule versions, tests, migration, rollback, and delivery impact. Product triages it; the relevant authority approves it. Examples requiring explicit requalification: a new catalog year, transfer-credit rule family, automatic communications, model vendor, registration write capability, or new institution.

Minor wording improvements can use ordinary review if they do not alter academic meaning. A changed eligibility rule must rerun the affected benchmark and receive academic approval even if it is a one-line change.

## Document authority

The original research is historical context. The PRD defines scope; the requirements specification defines observable behavior; the academic contract defines result meaning; the architecture and interface documents define implementation constraints. If these conflict, log a decision and update the affected documents. Do not silently select one interpretation.

Every baseline revision must list changed requirement IDs and why. Link requirements to tests and risks. Keep approval records outside generated narrative, with actual names and dates once obtained.

## Stakeholder communication

Students receive a plain-language account of what the product checks, where information comes from, what is unresolved, and how to reach a human. Advisors see their actual service hours and queue ownership. Sponsors receive outcome measurements with denominator and failure rates. Security and privacy reviewers receive evidence artifacts, not generic assurances.
