# V1 project proposal and business case

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Proposal

Working descriptor: Verified Advising Runtime (not a selected brand). Build an institution-sponsored web application that helps eligible students understand remaining requirements, construct validated next-term options, and prepare for an advisor discussion. The university remains the authority for records, requirements, registration, exceptions, and degree conferral.

Proposed pilot: one U.S. institution, one department, two or three undergraduate programs, one catalog cohort initially, and one upcoming term. Broaden catalog cohorts only after separate qualification. Begin with synthetic records, then advisor-only shadow evaluation, then a limited student pilot. Size the student cohort to support capacity; 50–100 opt-in students is a planning assumption rather than an enrollment commitment.

## Outcomes and boundaries

The primary outcome is a student making a better-informed course-planning decision without receiving an unsupported academic claim. Secondary outcomes are less routine advisor preparation time and better handoff context. Retention, excess credits, and time to degree are longer-term research outcomes; one short pilot cannot establish causal improvement.

The product writes its own plans, preferences, conversation state, and cases. It has no permission to add/drop courses, remove holds, update official transcripts, grant exceptions, or certify graduation. “Read-only” always means read-only to institutional academic systems, not an inability to save a local draft.

## Deliverables

- Qualified read adapters for one SIS, one authoritative audit source, and one section source, using permitted feeds if APIs are unavailable.
- Student Action Plan: outstanding requirements, next-term options, evidence, constraints, readiness checklist, and open advisor questions.
- Advisor workspace for supported students, reviewed plans, source discrepancies, and case resolution.
- Versioned institutional configuration and approved rule mappings.
- Evaluation suite, accessibility review, privacy/security controls, operational dashboards, and rollback procedures.
- Pilot report separating correctness, coverage, usability, cost, and advisor workload.

## Alternatives

| Option | Advantage | Cost or weakness | Decision |
|---|---|---|---|
| Configure existing tools | Lowest new integration burden | May not address explanation or cross-system UX | Investigate first |
| Catalog chatbot only | Quick demonstration | Cannot reliably allocate student credits or validate schedules | Reject for consequential recommendations |
| Full degree-audit replacement | Complete control | Large policy and institutional migration burden | Defer |
| Verified layer over audit | Focused problem with retained authority | Depends on audit access and semantic completeness | Proposed V1 |
| Public-catalog synthetic demo | Enables early design work without student records | Not evidence of production integration feasibility | Approved planning path, pending owner acceptance |

## Commercial hypotheses

Target institutions with a real student-facing planning gap and a willing registrar/IT sponsor. Do not assume community colleges are easier buyers. Qualify by unmet workflow, data access, budget owner, implementation capacity, and incumbent contract terms.

Potential pricing structure: paid discovery/integration setup plus annual institution subscription with explicit service limits. No price is established in this package. Quote only after the integration scope, support requirements, and procurement constraints are known.

Use a bottom-up cost model:

annual delivery cost = infrastructure + model inference + integration maintenance + support + assurance/security + allocated implementation cost.

Recovered advisor capacity = eligible interactions × adoption × verified self-service resolution rate × baseline minutes saved − review and escalation minutes.

Illustration only: 2,000 interactions/month × 40% adoption × 50% verified resolution × 8 minutes = about 53 gross hours/month. If review and support consume 20 hours, net capacity is about 33 hours. This is not equivalent to cash savings unless staffing or overtime costs actually change. Do not add retention revenue and tuition avoidance as if both accrue to the same stakeholder.

## Resource and schedule assumptions

Suggested delivery capacity: technical lead/backend engineer, integration/full-stack engineer, fractional product/design and QA/security support, and named institutional academic/IT reviewers. One founder can prototype but institutional review and production assurance remain separate workloads.

Illustrative sequencing: discovery 2–4 weeks; synthetic vertical slice 3–5; integration and shadow evaluation 4–8; controlled pilot 4–6. Some activities overlap; procurement may dominate the timeline. These are planning ranges, not a fixed quote or promised launch date. Estimate again after the adapter feasibility spike.

## Approval sought later

This package authorizes no production deployment and contains no assumed stakeholder approvals. The next decision is whether to accept the proposed discovery scope, identify a design partner, and investigate its data interfaces. Real-record use and student launch have separate gates in the delivery plan.
