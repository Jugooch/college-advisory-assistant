# UX design specification and accessibility plan

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Experience principle

The persistent Student Action Plan is the product's center. Conversation is one input method. Students should be able to understand requirements, compare schedules, and request help without composing prompts.

## Information architecture

Student navigation: Overview, Degree progress, Next-term planner, My plans, Help and cases. Advisor navigation: Assigned students, Review queue, Student workspace, Discrepancies. Admin navigation: Coverage, Sources, Configuration releases, Operational status, Access.

## Core screens

| Screen | Primary content | Primary action | Required non-happy states |
|---|---|---|---|
| Overview | Program/catalog, data timestamp, next steps, open case status | Plan next term | Unsupported program, stale record, outage |
| Degree progress | Completed/in-progress/remaining requirements with evidence | Inspect a requirement | Ambiguous allocation, pending transfer |
| Planner setup | Term, credit range, unavailable time, modality/campus | Find options | Conflicting user constraints |
| Option comparison | Course bundles, meetings, credits, conditions, unmet preferences | Save selected draft | No feasible result, incomplete search |
| Plan detail | Revision, validation dimensions, evidence, review status | Revalidate or ask advisor | Stale dependency, withdrawn section |
| Advisor case | Reason, affected checks, authorized context, timeline | Assign/review/resolve | Wrong queue, overdue case, source dispute |

## Content hierarchy

A plan card starts with validation state and term, then course choices and credits, then unmet conditions. Evidence is one interaction away, not buried in a transcript. Separate academic eligibility from seat/readiness information. Avoid a single green “approved” badge that conflates them.

Example: “Prerequisite condition: earn C or higher in Calculus I this term.” Below it: “Seat eligibility not verified. This section reserves some seats.” Avoid vague “AI confidence: 93%.” Advisor review is labeled with reviewer/time and scope, not as guaranteed permission to enroll.

## Interaction details

Constraint entry supports both a structured form and conversation. Extracted constraints are shown as editable chips or fields with a clear hard/preferred toggle. The system asks before interpreting “I'd like no Fridays” as a mandatory exclusion. A preference change creates a new plan revision, leaving the old version available.

Schedule interaction includes list and calendar views. Drag-and-drop is optional; add/remove and move controls are keyboard operable. Comparison uses consistent column order and textual labels. Unknown state has an explanation and next step. Retry controls do not discard confirmed preferences.

Case submission previews exactly what is shared and with which advising queue. Default to the plan, failing checks, and a short student-selected explanation. Do not send an entire chat transcript merely because it is available.

## Accessibility target

Target WCAG 2.2 AA (S04 in the research register) across complete core workflows. This is a design/acceptance target, not a claim of compliance. S06 describes the separate covered-public-entity rule using WCAG 2.1 AA; institutional legal applicability must be evaluated independently.

Provide meaningful headings and landmarks, programmatic labels, visible focus, logical focus order, keyboard alternatives, accessible validation errors, sufficient contrast, zoom/reflow, and non-color state distinctions. Use plain-language status descriptions. Announce completed planner updates without streaming a disruptive announcement for every token. Support reduced motion and avoid mandatory time limits beyond necessary session security with accessible warning/recovery.

Dense calendars need an equivalent structured list with course, dates, times, location, and conditions. Tables need headers and sensible reading order. Exported summaries require an accessible format too. Do not treat an accessible chat input as proof that the full planning workflow is accessible.

## Research and design deliverables before UI construction

Low-fidelity prototypes for the seven core screens, clickable primary student/advisor tasks, terminology review with advisors, keyboard/focus specification, and error/empty/stale state inventory. Visual identity can remain restrained and neutral until user comprehension is established; no final brand palette is selected here.

Usability study: ask representative students to build a plan, explain whether they are actually registered, identify a pending prerequisite, and request help. Measure task success and misunderstanding, not aesthetic preference alone. Include assistive-technology users and advisor review tasks. Log observed confusion and revise before student release.
