# Operations, pilot protocol, and success measurement

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Pilot structure

Stage 1: synthetic demonstrations and task studies. Stage 2: authorized advisor shadow evaluation with no student-facing recommendations. Stage 3: limited student use for qualified cohorts and one published term. Freeze pilot scope while measuring outcomes; new rule families require requalification.

Recruitment and participation language should explain the product's role, data processing, ability to contact an advisor, and that saving a plan does not register classes. Obtain the institution's determination of whether the evaluation requires research review or other approvals; do not assume a product pilot is exempt.

## Operating roles and service policy

Name a daily operator, academic escalation lead, integration owner, incident lead, and backup before launch. Proposed advisor case target: assignment within one business day and substantive response within two business days during published hours. These are staffing assumptions to approve, not promises to users today. High-urgency cases use institution-approved routing. The app must not imply continuous human monitoring.

Cap enrollment based on expected case volume: expected cases/day = active users/day × requests/user × escalation fraction. Include review time and follow-up in staffing estimates. If queues exceed capacity, reduce cohort exposure or temporarily restrict personalized planning; do not silently abandon cases.

## Operational dashboards

Track feed lag, failed imports, semantic mapping gaps, stale result rate, supported request volume, validation states, solver timeouts, model/tool failures, unauthorized access attempts, case backlog/age, per-request cost, and critical correctness reports. Use pseudonymous event IDs and bounded retention. Separate app availability from source freshness and successful planning coverage.

Key alerts: cross-tenant access evidence; critical academic defect; unmapped source schema; missing complete feed; source/audit skew; expired policies for supported cohort; dead escalation queue; abnormal export activity. Thresholds must be tuned to actual feeds and support capacity.

## Runbooks

Source outage: suspend dependent claims, retain timestamped historical views, notify operator, restore feed, reconcile versions, revalidate impacted plans. Rule defect: disable affected cohort/rule, enumerate impacted validations, academic adjudication, corrected approved release, regression/replay, institutional remediation process. Model outage: forms and structured cards remain; no unapproved provider failover. Database incident: preserve evidence, restore tested backups, apply deletion tombstones, reconcile app state, revalidate source-derived results before use.

Offboarding: disable access and imports; deliver approved export; revoke source credentials; execute retention/deletion workflow; confirm completion and backup expiry schedule; remove derived indexes and provider-held state as applicable.

## Measurement plan

Before pilot, observe routine planning interactions and record task time, advisor review time, error categories, resolution path, and unmet needs. During pilot use the same definitions. Prefer matched workflow comparisons or a feasible randomized rollout when institutionally approved; report selection effects if volunteers differ from the baseline group.

| Measure | Definition | Interpretation |
|---|---|---|
| Academic correctness | Adjudicated valid recommendations / adjudicated recommendations | Requires independent review and denominator |
| Useful coverage | Supported requests producing useful validated/conditional options / supported requests | Pair with refusals and escalation rate |
| Net advisor time | Baseline time minus review, escalation, and support time | May be negative early |
| Student comprehension | Students correctly identify conditions and registration status / tested students | Safety-relevant usability |
| Task completion | Completed planning tasks / attempts | Report abandonment and accessibility barriers |
| Cost per resolved request | Allocated variable costs / verified resolved requests | Do not divide only by chat messages |
| Adoption | Active qualified participants / invited eligible participants | Not evidence of academic benefit |

Proposed continuation thresholds: zero unresolved critical defects; positive net advisor-time trend; at least 80% of task-study participants understand plan-vs-registration and pending conditions; enough useful coverage to justify integration cost. The 80% is an initial research threshold, not an acceptable ceiling for misunderstanding; refine the UX for remaining failures before broad rollout. Institution and sponsor must agree final commercial thresholds before pilot data is examined.

## Pilot report outline

Cohort and exclusions; source/rule/model versions; measurement period; denominators; correctness findings; unknown and escalation handling; task study outcomes; accessibility issues; staffing burden; costs; incidents; limitations; comparison with baseline; recommendation to expand, revise, or stop. Do not claim improved retention or graduation from a short uncontrolled pilot.
