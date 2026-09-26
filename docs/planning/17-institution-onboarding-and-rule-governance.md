# Institution onboarding and academic configuration playbook

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Why this is a separate workstream

Academic policy configuration is a product operation, not a one-time data import. The partner must be able to understand what is supported, approve changes, and identify who resolves mismatches. A scalable business requires repeatable onboarding with measured effort.

## Onboarding deliverables

1. Named sponsor, registrar owner, IT owner, advising lead, privacy/security/accessibility contacts.
2. Signed scope matrix: supported programs, catalogs, terms, student categories, and excluded rule families.
3. Authoritative-source map and permitted feed/interface agreements.
4. Source samples and data dictionary, including null values, grade schemes, transfer identities, repeats, and exception semantics.
5. Identity/assignment model and access approval process.
6. Rule mapping register with source citations, academic reviewer, effective dates, and tests.
7. Reconciliation report comparing imported student/audit/section totals and sampled semantic cases.
8. Approved support routing, service hours, escalation categories, and privacy content.
9. Training, launch readiness evidence, and rollback ownership.

## Coverage matrix template

| Dimension | Pilot value | Evidence required |
|---|---|---|
| Institution | Unselected | Agreement and source registry |
| Programs | Proposed 2–3; actual IDs unselected | Registrar-approved list |
| Catalog cohort | One initial cohort; year unselected | Applicability rules |
| Term | One published future term; unselected | Complete section feed |
| Transfer credit | Only finalized approved mappings in qualified cases | Explicit test coverage; ambiguous records excluded/referral |
| Exceptions | Imported approved exceptions only | Scope and effective-date mapping |
| Dual degrees/minors | Excluded initially unless separately qualified | Allocation evidence before expansion |
| Prerequisite grammar | Source-specific supported subset | Parser semantics and reviewed fixtures |
| Section restrictions | Explicitly enumerated fields | Unknown handling for missing rules |

## Academic change process

The institutional source owner reports catalog, prerequisite, equivalency, and deadline changes. The integration owner detects source diffs. A domain reviewer classifies the change as informational, semantic, cohort-affecting, or emergency correction. Engineering maps the change and identifies affected tests and saved plans. An independent academic approver reviews the meaning and evidence. Publish an immutable version with effective dates and rollback.

For existing students, retain the correct catalog context. Do not apply the newest catalog simply because it is easier to fetch. Retroactive corrections require institution-defined handling and explicit impact review. Every affected saved plan is marked for revalidation; a student's previously reviewed plan does not remain valid by default.

## Reconciliation and quality

Compare record counts, missing IDs, program distributions, audit timestamps, requirement states, and allocations. Sample edge cases, not only typical students. A feed with correct row counts can still misinterpret grades. Every unmapped grade/status/restriction value is quarantined or represented as UNKNOWN until reviewed.

Maintain an exception dictionary: observed source pattern, intended semantics, supported status, representative case, owner, and resolution. Avoid undocumented one-off code branches for an individual student; student-specific exceptions must come from approved institutional records.

## Training and adoption

Train advisors on evidence inspection, conditional/unknown states, source discrepancies, and case ownership. Train administrators on coverage boundaries, configuration release, and rollback. Student onboarding should demonstrate that drafts are not registration and show where to ask for help. Use realistic but fictional examples in public training materials.

## Expansion checklist

A new program, catalog cohort, term structure, campus, or institution needs a fresh coverage review, representative cases, source authority validation, support capacity check, and release approval. Reuse components where semantics match; never equate connector compatibility with academic equivalence.
