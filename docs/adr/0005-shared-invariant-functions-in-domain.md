# ADR-0005: Shared invariant functions in `@caa/domain`

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Tech lead
- **Related:** FR-09, NFR-01, planning/08 §Authority and result semantics, planning/09 §Source authority matrix, planning ADR-04, issues #117, #107, PR #113

## Context

Some academic rules must be enforced in two places:

- The engine computes the result.
- A Zod schema rejects any value that breaks the rule. This can be a domain schema or an HTTP contract schema.

PR #113 has two such rules:

- **Aggregate precedence.** FAIL gives BLOCKED. Otherwise UNKNOWN gives NEEDS_VERIFICATION, then CONDITIONAL gives CONDITIONAL, and anything else is VALIDATED. An empty list gives NEEDS_VERIFICATION.
- **Record ↔ audit program and catalog consistency.** The record must state a program and a catalog, and both must equal the audit's. Otherwise the result is UNKNOWN (`AUDIT_PROGRAM_MISMATCH`).

The academic-safety reviewer requires the contract to reject a response that breaks either rule, because the contract is where the API and web layers enforce result semantics end to end.

The layering blocks the obvious fixes:

- `@caa/api-contract` may import only `@caa/domain` and `zod`. It can't call the engine.
- Standard 01 puts academic rules in `packages/engine`.
- Standard 04 rule 11 allows no behavior in models.
- A private copy of the rule in the contract is a second, hand-synced definition, and the architecture reviewer blocked it (#113 at `e603807`).
- Moving the function into a domain `.enum.ts` was blocked too, because no ADR allowed it (#113 at `5cc5c54`).

The options were:

1. **Shared invariant functions in domain.** Put the rule once in `@caa/domain`. The engine and the schemas both call it.
2. **Engine only.** The contract drops the refine or checks only a weaker condition. This loses the guarantee the safety reviewer requires. For example, a FAIL reported as CONDITIONAL would parse.
3. **A new shared package**, such as `@caa/rules`, that both the engine and the contract may import. That adds a package, a layer, and a dependency edge, just to hold a few pure functions over domain types.
4. **Two copies plus a drift test.** A test asserts that the copies agree. That still leaves two definitions, and the test only covers the inputs it lists.

## Decision

Option 1. A **shared invariant** is an exported function in `@caa/domain` that meets every one of these limits:

1. **Needed on both sides.** The engine must produce the result, and a domain or contract schema must enforce it in a `.refine`. A rule that only the engine needs stays in the engine.
2. **Pure and total.** Its inputs are domain types, or `Pick`s of them. It returns a boolean or a domain enum value for every input and never throws. It has no I/O, no clock, no randomness, and no module state, and it imports only `zod` and domain files.
3. **Small and literal.** It encodes one rule stated in a planning doc. It has a `// SAFETY:` comment that cites the section, and TSDoc that names it a shared invariant under this ADR. It doesn't load policy, attach evidence, choose reason codes for several outcomes, or compose other rules. Those stay in the engine.
4. **Placed with the type it's about.** No new role suffix and no new folder:
   - A rule over one enum's values goes in that enum's `.enum.ts`. For example, `deriveAggregateState` goes in `check-state.enum.ts`, next to `AggregateState`.
   - A rule over one or two models goes in the `.model.ts` of the model the rule checks. When two models are involved, that's the one whose file already imports the other, so no import cycle appears. For example, program and catalog consistency goes in `audit-snapshot.model.ts`, which already imports `student-snapshot.model.ts`.
5. **One implementation.** The engine calls the domain function and never restates it. An engine function may wrap it to attach reason codes, evidence, or source references. It may keep its public name, but its body delegates. A schema calls it inside `.refine`.
6. **Not a service or UI tool.** Services get academic results from the engine. Web renders the states the API returns and never imports a shared invariant to recompute or upgrade a state (standard 06). Contract schemas that run in the web client may still call it, because that's validation, not a decision.
7. **Tested in domain with literal values.** Its unit tests sit in the colocated domain test file and use literal expected values. Engine and contract tests keep their own literal cases, and none of them computes an expected value by calling the function, so the test oracle stays independent.

Generic helpers are out of scope, for example `isDistinct`. Domain isn't a utility package. Such helpers stay private to the file that uses them.

This doesn't change a planning ADR. Planning ADR-04 (modular monolith) and the dependency graph in standard 01 are unchanged: the engine and the contract already depend on domain.

### The two current rules

- `deriveAggregateState(states)` goes in `packages/domain/src/enums/check-state.enum.ts`, as #113 already has it.
- `isSameProgramAndCatalog(record, audit)` goes in `packages/domain/src/models/audit-snapshot.model.ts`:
  - Its inputs are `Pick<StudentSnapshot, 'programId' | 'catalogYear'>` and `Pick<AuditSnapshot, 'programId' | 'catalogYear'>`.
  - It returns `false` when the record's program or catalog is `null` or differs from the audit's.
  - The academic-summary contract refine calls it. The #107 engine check calls it too, and maps `false` to UNKNOWN `AUDIT_PROGRAM_MISMATCH`.

### The transitional duplicate

Until #107 lands, `packages/engine/src/verification/aggregate-check-states.ts` keeps its own copy of the precedence. #107 is the follow-up that removes it: `aggregateCheckStates` must delegate to `deriveAggregateState` or be replaced by it. #107 also adds the program and catalog check, which calls `isSameProgramAndCatalog`.

Until then, domain docs must not claim that the engine already delegates. No new engine code may restate either rule.

## Consequences

- One definition of each rule, enforced by both the engine and the HTTP contract. The contract can reject a FAIL reported as CONDITIONAL, and a program conflict reported as PASS.
- `@caa/domain` now holds a small amount of academic logic. The limits above keep it to single rules that schemas must enforce. Reviewers check new exported domain functions against the list, and anything outside it is a MAJOR finding.
- Engine-engineers must look in domain before writing a rule that a schema might enforce. Restating a shared invariant is a MAJOR finding.
- A change to a shared invariant is a domain PR, and it changes the engine's behavior. Such a PR needs the engine and golden tests to pass, and the academic-safety review applies as for any engine rule.
- Standard 01 and standard 04 rule 11 are amended to match. The architecture-reviewer, domain-engineer, and engine-engineer agent definitions state the rule.
- Tooling: domain has no determinism lint today. The devops-engineer extends the engine's `Math.random` and `Date.now` restrictions in `config/eslint/layer-boundaries.mjs` to `packages/domain/src/**`, with a test in `layer-boundaries.test.mjs`. Until that lands, review enforces it.

## Revisit when

- A proposed shared invariant needs more than its arguments, such as policy lookup or composing other rules.
- Domain has more than about ten shared invariants, which would suggest a real rules package (option 3).
- The engine and a schema need different versions of the same rule, for example during a rule-version transition.
