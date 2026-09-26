# 06 · Frontend (Next.js)

`apps/web` is presentation only. It has no database access, no business rules, and no API route handlers. It talks to `apps/api` through `src/api/*.api.ts`.

## Layers

| Folder                              | Role                                                                           | May import                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `src/app/**/page.tsx`, `layout.tsx` | Route entry. Fetch data via `src/api` (server components) and compose features | `@/api`, `@/features`, `@/components`, contract types                |
| `src/features/<feature>/components` | Feature UI. Receives data via props or the feature's hooks                     | `@/components`, own hooks/utils, contract/domain **types and enums** |
| `src/features/<feature>/hooks`      | Client-side data and state for the feature                                     | `@/api`, own utils                                                   |
| `src/features/<feature>/utils`      | Pure view helpers (formatting, sorting for display)                            | Types only                                                           |
| `src/components/ui`                 | Shared presentational primitives, no feature knowledge                         | Nothing app-specific                                                 |
| `src/api`                           | Backend calls                                                                  | `@/lib/api-client`, `@caa/api-contract`                              |
| `src/lib`                           | App-wide singletons                                                            | `@caa/api-contract`                                                  |

Components never import `@/api` directly (lint-enforced). Pages stay thin: fetch, handle the error/empty case, and render features.

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
