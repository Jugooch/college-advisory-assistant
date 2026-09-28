# 06 · Frontend (Next.js)

`apps/web` is presentation only. It has no database access, no business rules, and no API route handlers. It talks to `apps/api` through `src/api/*.api.ts`.

## Layers

Pages, API calls, and data objects each have their own place (ADR-0007). Every folder imports only what its row allows (lint-enforced):

| Folder                                | Role                                                                            | May import (app code)                                                          | From `@caa/api-contract` and `@caa/domain` |
| ------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| `src/app/**` (Next.js reserved files) | Route entry: read params through a util, call `src/api`, handle error and empty | `@/api`, `@/features/*/{components,utils,actions}`, `@/shared`, `@/components` | Types and values                           |
| `src/features/<feature>/components`   | Feature UI. Receives data via props or the feature's hooks                      | `@/components`, `@/shared`, own hooks and utils                                | Types and values                           |
| `src/features/<feature>/hooks`        | Client-side data and state for the feature                                      | `@/api`, `@/shared/utils`, own utils                                           | Types, values, schemas                     |
| `src/features/<feature>/utils`        | Pure view helpers and input parsing for the feature                             | `@/shared/utils`, `@/components/ui` (prop types), own utils                    | Types, values, schemas                     |
| `src/features/<feature>/actions`      | Server actions (§Server actions)                                                | `@/api`, `@/lib`, `@/shared/utils`, own utils                                  | Types, values, schemas                     |
| `src/shared/components`               | App-specific display used by more than one feature or page                      | `@/components`, `@/shared/utils`, other shared components                      | Types and values                           |
| `src/shared/utils`                    | App-specific pure helpers used by more than one feature or page                 | `@/components/ui` (prop types), other shared utils                             | Types, values, schemas                     |
| `src/components/ui`                   | Generic presentational primitives, no app knowledge                             | Other `@/components/ui` files only                                             | Nothing                                    |
| `src/api`                             | Backend calls (standard 05 §Frontend API calls)                                 | `@/lib/api-client`                                                             | Everything, including endpoints            |
| `src/lib`                             | Server infrastructure: the API client and the session cookie                    | Other `@/lib` files                                                            | Everything                                 |

What the last column means:

- **Types:** `import type`.
- **Values:** `as const` enum objects (`CheckState`), `UPPER_SNAKE` constants (`MAX_COURSE_CHECK_COURSES`), and the `ApiError` class. These are PascalCase or `UPPER_SNAKE` exports that don't end in `Schema`.
- **Schemas:** `*Schema` exports, for parsing external input with `safeParse` (standard 09). Pages and components don't parse. They call a util that does.
- **Never outside `src/api` and `src/lib`:** camelCase exports, which are functions and endpoint definitions. Web code never imports a domain factory or a shared invariant (standard 04, ADR-0005), and it never recomputes an academic state.

The rules that keep this simple:

- **Features don't import other features.** A feature imports only its own folders, through relative paths. Pages compose several features.
- **Shared code is promoted, not planned.** Code starts in its feature. It moves to `src/shared` in the same PR that gives it a second user, whether a feature or a page. Shared code knows no feature: it takes contract and domain values and returns display values or elements. Examples are the reason-code and check-state wording, credit and timestamp formatting, and the API error notice.
- **`src/shared` has only `components/` and `utils/`.** It has no hooks, actions, or API calls.
- **`src/components` has only `ui/`.** A primitive there must make sense in any app. Anything that names an academic state, a reason code, or an error code goes in `src/shared`.
- **`src/lib` holds no feature logic.** It holds the API client and the session cookie (name, attributes, read, write, clear). It parses no forms and never redirects. Only `src/api` and actions import it.
- Components never import `@/api`, `@/lib`, or actions. Pages stay thin: read params, fetch, handle the error or empty case, and render features.

## Server actions

A server action handles a form post that changes state: it sets or clears the session cookie, or calls a backend endpoint that saves something. It plays the role a controller plays in the API. Read-only forms, such as a student lookup, stay plain `GET` forms that the page reads through its search params.

- **File:** `src/features/<feature>/actions/<verb>-<noun>.action.ts`. It starts with the `@file` header and then the `'use server'` directive. It exports exactly one async function, named `<verb><Noun>Action`, for example `devSignInAction`.
- **`'use server'` appears nowhere else.** Pages and components never define inline actions.
- **Shape:** about 15 lines. Check the action's own preconditions, parse `FormData` with a Zod schema from the feature's utils or the contract, make one call (a `src/api` function or a `src/lib` session helper), then `redirect` or return a result the form can show.
- **Decisions live in utils.** Gates and parsing (for example `isDevSignInEnabled(nodeEnv)` and the dev-token schema) are pure functions in the feature's utils, with unit tests. The action only wires them to `cookies()`, `@/api`, and `redirect`. Its own test mocks `next/headers` and `next/navigation`.
- **Wiring:** a page imports the action and passes it to a component as a prop. Components never import actions.
- **Security:** every action is a public POST endpoint. It re-checks its own preconditions, such as the production gate, and never relies on the page hiding the form. It never sends a tenant, user, or role from `FormData` to the API (standard 09).

## Components

- One component per file; file `plan-card.tsx` exports `PlanCard`.
- Props interface named `<Component>Props`, exported, with `readonly` fields and doc comments on non-obvious fields.
- Server components by default. Add `'use client'` only when the component needs state, effects, or browser APIs, and keep client components small.
- Return type `ReactElement` (or `Promise<ReactElement>` for async server components).
- No inline business logic. If a component decides something about eligibility, it's in the wrong place: the API returns validated states and the UI displays them.

## Displaying academic states

- Render check states (`PASS`, `FAIL`, `UNKNOWN`, `CONDITIONAL`) and aggregate states from the API as returned. Never recompute or upgrade them in the UI.
- Each dimension (applicability, prerequisite, schedule, seat, readiness) is shown separately. No single green "approved" badge.
- A saved plan is never labelled "registered".
- Every consequential value shows its evidence one interaction away.

## Accessibility (target: WCAG 2.2 AA)

- Semantic HTML first: headings in order, landmarks (`main`, `nav`), `button` for actions, `a` for navigation.
- Every input has a programmatic label; errors are announced and linked with `aria-describedby`.
- State is never conveyed by color alone (see `StatusBadge`: the text carries the meaning).
- Everything works by keyboard with a visible focus indicator; no drag-only interactions.
- Dense calendars have an equivalent structured list.
- Live updates use `aria-live="polite"` once per completed update, never per streamed token.
- `eslint-plugin-jsx-a11y` (strict) runs in lint; the accessibility reviewer checks what lint can't.

## Styling

Plain CSS with design tokens in `src/app/globals.css` until the UX study selects a design system. Class names are BEM-style kebab-case: `status-badge`, `status-badge--positive`. No inline `style` props except for truly dynamic values.
