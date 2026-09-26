# Risk register, assumptions, decisions, and open questions

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Risk register

Ratings are qualitative initial judgments, not measured probabilities. Owner roles must be assigned to real people before the corresponding gate.

| ID | Risk | Likelihood / impact | Mitigation and trigger | Owner |
|---|---|---|---|---|
| R01 | Audit cannot validate proposed course allocation | High / critical | Prove hypothetical semantics at G0/G2; narrow scope if absent | Technical + academic lead |
| R02 | Stale or inconsistent records produce misleading result | High / critical | Pin snapshots, skew checks, freshness expiry; suspend affected claims | Integration lead |
| R03 | Local interpretation differs from institution | High / critical | Dual review and adjudicated corpus; discrepancy queue | Registrar |
| R04 | Unauthorized record disclosure | Medium / critical | Object authorization, isolation, access reviews, incident drills | Security lead |
| R05 | Existing product already solves the need | High / high | Incumbent demo and actual workflow interviews before build | Product lead |
| R06 | Model turns uncertainty into confident advice | High / critical | Structured academic rendering, restricted tools, adversarial tests | Technical lead |
| R07 | Integration setup consumes margin | High / high | Track setup effort, limit adapters/cohorts, paid discovery | Sponsor |
| R08 | Escalation volume overloads advisors | Medium / high | Capacity cap, staffed pilot, measure review minutes | Advising manager |
| R09 | Rule/model update breaks prior behavior | Medium / critical | Versioning, frozen holdout, canary cohort, rollback | Release owner |
| R10 | Contract/provider terms incompatible with data use | Medium / critical | Privacy review before real records; model-free fallback | Privacy lead |
| R11 | Student misunderstands plan as registration | Medium / high | Explicit UI boundary and comprehension tests | Design lead |
| R12 | Accessibility blocks core tasks | Medium / high | Manual AT testing early; accessible list alternatives | Accessibility lead |
| R13 | Future offerings presented as certainty | Medium / high | Exclude multi-year guarantee; label scenarios | Academic lead |
| R14 | Pilot metrics exaggerate benefit | Medium / high | Baselines, denominators, review overhead, no causal retention claim | Product/research lead |

## Assumptions to validate

A01: U.S. higher education is the initial market. A02: institution-sponsored deployment is viable. A03: one partner can provide an authoritative audit and structured records. A04: planning is initially next-term only. A05: a named advisor queue can absorb escalations. A06: two or three programs can be qualified without a full audit replacement. A07: a read-only integration contract is available. A08: the institution can approve a model provider or accept model-free operation. These assumptions are proposals, not statements supplied by the user.

## Architecture decision records — proposed

| ADR | Decision | Rationale | Revisit trigger |
|---|---|---|---|
| ADR-01 | Consume authoritative audit | Avoid recreating academic allocation | Partners lack usable audit capability |
| ADR-02 | Read-only institutional systems | Reduce transactional and permission risk | Proven pilot plus explicit registration scope |
| ADR-03 | Next-term planning only | Published sections permit more defensible validation | Multi-year offering data and scenario model qualified |
| ADR-04 | Modular monolith + worker | Keep operations manageable | Measured scale or isolation needs |
| ADR-05 | Structured academic output | Constrain unsupported consequential statements | Independent evidence supports expanded paraphrase |
| ADR-06 | Immutable versioned validation | Reproducibility and change analysis | Retention requirements constrain historical data |
| ADR-07 | No predictive student risk model | Not required for the core job | Separate validated and approved use case |
| ADR-08 | No automated external outreach | Keep pilot support bounded and transparent | Separate communications authorization/workflow |

Each ADR requires a named approver and date before it becomes accepted. Decisions may be adopted for the synthetic prototype without implying institutional approval.

## Questions blocking implementation planning

| Question | Needed by | Responsible decision maker |
|---|---|---|
| Which institution, department, programs, and catalog cohorts? | G0 | Founder + partner sponsor |
| What exact workflow is currently failing, and how often? | G0 | Product research |
| What audit/SIS products and licensed interfaces are available? | G0 | Institutional IT |
| Can the audit evaluate planned combinations and expose evidence? | G0/G2 | Registrar + vendor administrator |
| Who approves rule mappings and resolves discrepancies? | G0 | Registrar |
| What is the available engineering budget and team? | G0 | Founder |
| Which students are eligible, and how are advisors assigned? | G2 | Advising manager |
| Which data fields, regions, providers, and retention are allowed? | G2 | Privacy/security |
| What peak loads, source SLAs, and support hours apply? | G2 | IT + operations |
| What procurement/accessibility evidence is required? | G2 | Procurement + accessibility owner |
| What measured benefit would justify purchase or expansion? | G4/G5 | Economic buyer |

## Dependency register

External: partner agreement; vendor API/export entitlement; identity-provider setup; approved catalog/rule source; reviewer availability; privacy/security/accessibility review; advisor support capacity. Internal: data contract; evaluation corpus; observability; operational ownership. A missing external dependency should be recorded with owner and due date rather than hidden inside a generic engineering estimate.
