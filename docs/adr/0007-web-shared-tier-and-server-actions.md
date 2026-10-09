# ADR-0007: Web shared display tier, server actions, and runtime imports

- **Status:** Accepted; amended 2026-10-09 (Amendment 1: the shared tier stays flat, with domain-first names)
- **Date:** 2026-09-28
- **Deciders:** Tech lead
- **Related:** amends ADR-0001, standards 01, 04, 06, issues #154, #101, PRs #148, #149

## Context

The first student screens (#148, #149) needed three things that standard 06 §Layers had no place for:

1. **Shared, app-specific display code.** Several features need the reason-code wording, the check-state wording, credit and timestamp formatting, and the API error notice. The PRs made `verification-states` and `service-errors` into features that other features import. Standard 06 doesn't allow a feature to import another feature. `src/components/ui` must hold nothing app-specific, `src/components/**` allows only `.tsx`, and `src/lib` is for singletons.
2. **Server actions and session logic.** Dev sign-in parses a form, gates on the build, and writes the session cookie. The PR put that logic in `src/lib/dev-sign-in.ts` and defined inline `'use server'` actions in the page. Standard 06 doesn't mention server actions.
3. **Runtime imports in utils.** Standard 06 limits feature utils to types. But query parsing needs contract schemas and constants, and wording maps need runtime enums.

The repo owner asked for a simple, strict, MVC-like split: pages, API calls, and data objects each in their own area, with short files.

The options for shared display code were:

- **A. `src/features/shared/`**, a feature that others may import. It keeps the feature folder shape, but "features never import features" then needs an exception, and lint can't tell a shared feature from a real one without a special case.
- **B. `src/components/<domain>/` plus a shared utils folder.** The components tier gains open-ended subfolders, and utils need a second new home anyway.
- **C. `src/shared/{components,utils}`**, a tier between features and `components/ui`. It has the same two folder roles as a feature, and a one-way rule: features and pages may import it, and it imports no feature.

For server actions, the options were to keep them inline in pages, to put them in `src/lib`, or to give them a role in their feature.

## Decision

**Option C, a `src/shared` tier.**

- `src/shared/components/*.tsx` and `src/shared/utils/*.ts` hold app-specific display code used by more than one feature or page. There are no other subfolders: no hooks, actions, or API calls.
- Code is promoted, not planned. It starts in its feature and moves to `src/shared` in the PR that gives it a second user.
- Shared code imports no feature, `@/api`, or `@/lib`. Features never import other features. They reach their own files through relative paths.
- `src/components` holds only `ui/`. That's generic primitives that import nothing from `@caa/*` or other app folders.

**Server actions get a role in their feature.**

- `src/features/<feature>/actions/<verb>-<noun>.action.ts` starts with `'use server'` and exports one async `<verb><Noun>Action`. `'use server'` appears nowhere else.
- An action is the web's controller: check preconditions, parse `FormData` with Zod, make one call (`src/api` or a `src/lib` session helper), then redirect or return a result.
- Gates and parsing are pure functions in the feature's utils, with unit tests.
- Pages import actions and pass them to components as props. Components never import actions.
- `src/lib` is redefined as server infrastructure: the API client and the session cookie (name, attributes, read, write, clear). It holds no feature logic, and only `src/api` and actions import it.

**Runtime imports follow the export's naming, so lint can check them.** From `@caa/api-contract` and `@caa/domain`:

| Kind                                               | Naming                    | Who may import it                                                |
| -------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| Types                                              | `import type`             | Everyone except `components/ui`                                  |
| Values: enum objects, constants, `ApiError`        | PascalCase, `UPPER_SNAKE` | Everyone except `components/ui`                                  |
| Schemas                                            | `*Schema`                 | Utils (feature and shared), hooks, actions, `src/api`, `src/lib` |
| Functions and endpoint definitions                 | camelCase                 | `src/api` and `src/lib` only                                     |
| Domain factories and shared invariants (camelCase) | camelCase                 | No web production code (standard 04, ADR-0005)                   |

Pages and components import types and values but no schemas. When a page needs parsed params, it calls a util.

### Where the #148 and #149 code goes

| Today                                                                                            | Moves to                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/verification-states/utils/{reason-code-wording,check-state-wording,format-display}.ts` | `shared/utils/`                                                                                                                                                                                                                                                                                |
| `features/verification-states/components/{reason-explanation,timestamp}.tsx`                     | `shared/components/`                                                                                                                                                                                                                                                                           |
| `features/service-errors/utils/error-code-wording.ts`, `components/api-error-notice.tsx`         | `shared/utils/`, `shared/components/`                                                                                                                                                                                                                                                          |
| `lib/dev-sign-in.ts`                                                                             | Split. `isDevSignInEnabled` and the token schema go to `features/session/utils/dev-sign-in.ts`. Cookie writing goes to `lib/session-cookie.ts` (`writeSessionToken`, `clearSessionToken`). The two actions go to `features/session/actions/dev-sign-in.action.ts` and `dev-sign-out.action.ts` |
| Inline `'use server'` functions in `app/dev/sign-in/page.tsx`                                    | Removed. The page imports the two actions                                                                                                                                                                                                                                                      |
| `keepApiError` / `loadSummary` in the pages                                                      | One helper in `shared/utils/`                                                                                                                                                                                                                                                                  |
| `readQuery` in `app/course-checks/page.tsx`                                                      | `features/course-checks/utils/course-check-query.ts`, with unit tests                                                                                                                                                                                                                          |
| `studentId` query parsing                                                                        | `shared/utils/`, with `StudentIdSchema.safeParse`, because both pages use it                                                                                                                                                                                                                   |
| `features/student-navigation`                                                                    | Stays a feature. Only pages use it                                                                                                                                                                                                                                                             |

## Consequences

- Every web file has exactly one home, and the import direction is one-way: `app` → `features` → `shared` → `components/ui`, with `api` → `lib` beside them. Lint can enforce all of it with import rules and folder rules.
- Two components folders exist (`shared/components` and `components/ui`). The test for which one: if it names anything in this app's domain, it's shared.
- Moving code to `src/shared` touches the files that import it. That's intended: a second user is the signal.
- Server actions are testable without a browser. Decisions sit in utils, and the action's glue is tested with mocked `next/headers` and `next/navigation`.
- Tooling: the devops-engineer adds the folder and suffix rules to `scripts/lib/structure-rules.mjs`, the import rules to `config/eslint/web.mjs`, and the `'use server'` placement check. Until those land, review enforces this ADR.
- ADR-0001's decision (Next.js with a separate API, no route handlers) is unchanged. Server actions call the API. They never replace it.

## Revisit when

- A hook is needed by more than one feature. Shared hooks would need `src/shared/hooks` and a rule on `@/api` imports.
- `src/shared` grows past about 20 files, which suggests domain subfolders. Superseded by Amendment 1, which sets a new trigger.
- A server action needs to do more than one call, which suggests the logic belongs in the API.

## Amendment 1 (2026-10-09, issue #558): the shared tier stays flat, with domain-first names

**Related:** §Revisit when; standard 01 §Folder layout per workspace; `scripts/lib/structure-rules.mjs`; issues #558, #578; architecture review of #554.

**Context.** The revisit trigger (about 20 files) has fired: after PR #554, `src/shared` holds about 60 source files, plus their tests. The architecture review of #554 asked whether to group them by domain. The options were:

- **(a) Domain subfolders** (`shared/schedule`, `shared/requirements`, `shared/plans`, `shared/cases`, `shared/common`, each with `components/` and `utils/`). Each folder is smaller, but every import of a shared file in every feature changes in one move PR. The structure rules and their tests change too. And during S7 that PR would conflict with all three web polish PRs (#586–#588) and the reload render (#580).
- **(b) Stay flat, with a naming rule.** Most files already start with their domain noun (`schedule-results`, `requirement-table`, `option-card`, `case-wording`, `freshness-banner`). Sorted by name, they already group by domain, and nothing has to move.
- **(c) Stay flat, with no rule.** This leaves the review finding unanswered.

**Decision: (b).**

- `src/shared/components/` and `src/shared/utils/` stay flat. §Decision is unchanged.
- A shared file's name starts with its domain noun: `requirement-`, `course-`, `section-`, `schedule-` or `option-`, `plan-`, `case-`, `policy-`, `freshness-`, `constraint-`, `credit-`, or `session-`. Cross-cutting helpers (`timestamp`, `heading-level`, `keep-api-error`, `api-error-notice`, `format-display`, `error-code-wording`, `reason-code-wording`) keep their names. Review enforces this; no tooling change is needed.
- Existing files that don't follow the rule are renamed only when a PR already touches them for another reason. There is no rename PR.

**Consequences.** No move PR and no tooling change. Review checks names, so #558 needs no frontend follow-up. Moving to subfolders later will still be one mechanical PR, because the prefixes map one-to-one onto folders.

**Revisit when** `src/shared` passes about 100 source files (tests excluded), or one domain prefix passes about 25. Do the move at the start of a sprint, before any web PR is open, and give the devops-engineer a structure-rule change first.
