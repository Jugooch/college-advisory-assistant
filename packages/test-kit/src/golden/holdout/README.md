# Frozen holdout golden set

planning/13 §Golden corpus design asks for "a frozen holdout set separate from development fixtures". This folder is that set. Its value depends on the engine never being tuned to it, so these rules apply to every agent and person.

## How it stays separate

1. **Separate entry point.** The holdout isn't exported from `@caa/test-kit`. It's reachable only through the subpath `@caa/test-kit/golden-holdout` (`holdout-corpus.ts`).
2. **One consumer.** Only `tests/golden/holdout.golden.test.ts` imports it. `tests/golden/holdout-isolation.test.ts` scans `packages/*/src` and `apps/*/src` and fails if any file there imports the subpath or a file in this folder.
3. **Distinct IDs.** Holdout cases use `GH-<FAMILY>-NNN`; development cases use `GC-<FAMILY>-NNN`. The isolation test also checks that no ID appears in both sets.
4. **Owned by QA.** Only the qa-engineer adds or changes files here (`.github/ownership.json`).

## Rules for engineers who build the engine

- Don't open or read the case files in this folder, and don't use them as fixtures, examples or debugging inputs. Use the development corpus (`GOLDEN_DEVELOPMENT_CORPUS` from `@caa/test-kit`) instead.
- Don't import `@caa/test-kit/golden-holdout` from any package, app or engine test.
- When a holdout case fails in CI, the qa-engineer files a `bug` issue that states the gap in planning terms (the rule family and the planning or decision citation), not the case's literal inputs.

## Rules for QA

- **Frozen.** A holdout case's expectation is never changed to match engine output. A disagreement is a finding (a `bug` issue), not an edit.
- **Burning a case.** Once a holdout case has been used to diagnose a defect, it's no longer blind. Move it to the development corpus under a new `GC-` ID and replace it with a new, independently written `GH-` case.
- **Versioning.** Adding, burning or replacing a case cuts a new `GOLDEN_HOLDOUT_VERSION`, recorded in the PR.
- **Adjudication.** Every case records its rationale, citations, reviewer (`pending-academic-review` until an academic domain owner signs off) and adjudication date, exactly like development cases.
