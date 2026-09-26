# Research assessment, evidence, and discovery plan

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Executive judgment

There is a plausible problem worth investigating: students must reconcile requirements, transcript history, available sections, and personal constraints across institutional systems. A conversational interface can reduce navigation and explanation friction. The startup opportunity is unproven: neither the attachment nor the research performed for this package establishes willingness to pay, integration access, switching appetite, or a defensible advantage over incumbents.

The proposed wedge is a verified advising layer around an existing degree audit. V1 should demonstrate reliable, understandable next-term options and useful advisor handoffs for a tightly bounded cohort. Do not frame this as replacing academic advisors or guaranteeing graduation.

## Evidence register

The following primary sources were retrieved September 25, 2026. Vendor pages establish advertised capability, not independently measured outcomes. No customer interviews were conducted for this package.

| ID | Source and link | What it supports | Limit |
|---|---|---|---|
| S01 | [CollegeSource uAchieve Degree Audit](https://collegesource.com/degree-planning-tools/uachieve-degree-audit/) | Commercial degree-audit tools already exist | Does not prove local API access or accuracy |
| S02 | [CollegeSource uAchieve Planner](https://collegesource.com/degree-planning-tools/uachieve-planner/) | Vendor advertises planning using existing audit data | Search-retrieved product description; full-page fetch failed; verify in procurement |
| S03 | [Department of Education: school-official outsourcing conditions](https://studentprivacy.ed.gov/faq/are-there-any-limitations-what-education-records-may-be-disclosed-community-based-organization) | Outsourced record access has specific conditions, including direct control and restricted use | Institution must determine applicability and contractual implementation |
| S04 | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Technical accessibility recommendation | Conformance needs implementation testing |
| S05 | [EDUCAUSE HECVAT](https://www.educause.edu/higher-education-community-vendor-assessment-toolkit) | Higher-education vendor assessment includes privacy and AI questions | Questionnaire is not certification or procurement approval |
| S06 | [DOJ web accessibility fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/) | Covered public entities have a WCAG 2.1 AA web/mobile rule; page reflects 2026 deadline extensions | Institution-specific applicability and timing need review |

## Corrections to the original research

1. “The AI can never invent requirements” cannot be guaranteed by prompts or citations. Consequential statements must be rendered from validated structured results; unsupported generated advice must not be released as a recommendation.
2. Determinism is reproducibility, not proof of correct source rules. Incorrect mappings or stale records produce consistently wrong answers. Institutional approval and independent evaluation are necessary.
3. An existing degree audit may describe completed coursework without supporting hypothetical planned-course allocation. API entitlement and hypothetical-audit support are feasibility gates, not implementation details to assume away.
4. Zero observed failures is not zero underlying risk. Under a simplified independent-trial model, zero failures in n cases gives an approximate one-sided 95% upper bound of 3/n. Real academic cases are correlated; coverage by rule family matters more than a large duplicated test count.
5. Future offerings, passing grades, reserved seats, and admission decisions are uncertain. A plan is conditional, and a seat snapshot does not establish registration eligibility.
6. “Automate 70%” and “30% fewer interactions” are hypotheses, not measured outcomes. Do not use these values in sales collateral as research results.
7. GPA, catalog rules, academic standing, and requirement allocation should be imported from authoritative systems in V1. A generic local engine must not silently contradict those systems.
8. Accessibility deadlines are time-sensitive. S06 reports April 26, 2027 and April 26, 2028 dates after a 2026 extension, depending on public-entity category. These dates do not remove existing accessibility duties; counsel must map the actual institution.

## Competitive validation work

The original answer names Stellic, uAchieve, Kuali, Ellucian, Workday, EAB, Civitas, Salesforce, Element451, Ocelot, and Mainstay. Treat this as a discovery shortlist. Their complete feature sets, prices, customer counts, funding, and integration terms were not reverified here.

For each shortlisted institution, compare the product already licensed against our proposed workflow. Request a live demonstration of next-term planning, source-level explanations, unknown-state handling, and advisor escalation. Record licensed modules, accessibility evidence, supported APIs, implementation effort, and contractual restrictions. If an incumbent configuration resolves the problem cheaply, that may invalidate the proposed sale.

## Discovery protocol

Interview 8–12 students across transfer, working, part-time, and traditional pathways; 4–6 advisors; the registrar or curriculum owner; an SIS administrator; accessibility, security, and procurement representatives. Counts are proposed research targets, not completed work. Recruit through an institution-approved process and use synthetic records until data permissions exist.

Ask students to show the last time they chose courses, where they became unsure, what they checked, and what happened. Ask advisors to classify a recent sample of routine interactions, time spent, and escalation reasons. Ask the registrar to walk through a catalog exception and an audit dispute. Ask IT to provide a redacted integration sample, licensing constraints, refresh cadence, and outage behavior. Avoid questions that merely invite approval of “AI advising.”

Deliverables: anonymized interview notes, observed journey map, workflow frequency baseline, data capability matrix, an incumbent comparison, willingness-to-pilot evidence, and a ranked problem list. Do not retain sensitive student narratives unnecessarily.

## Feasibility decision

Proceed to a synthetic prototype only if a useful bounded workflow is identified. Proceed to real-record shadow evaluation only after permitted data access, an authoritative source for requirement allocation, an institutional academic owner, and an escalation owner exist. If those are absent, revise the scope or stop; do not substitute public PDF scraping for authoritative student-specific determinations.
