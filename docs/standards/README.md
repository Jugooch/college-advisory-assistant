# Engineering standards

These standards are binding for every contributor, human or agent. Reviewers cite them by file and section. Most rules are enforced by tooling; the rest are enforced in review.

| #   | Standard                                                           | Enforced by                                                           |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 01  | [Repository structure and file naming](01-repository-structure.md) | ESLint `check-file`, `scripts/check-conventions.mjs`, ownership check |
| 02  | [TypeScript style](02-typescript.md)                               | ESLint `typescript-eslint` strict, Prettier, `tsc` strict             |
| 03  | [Comments and documentation](03-comments.md)                       | ESLint `jsdoc`, `scripts/check-conventions.mjs`                       |
| 04  | [Data objects](04-data-objects.md)                                 | Folder rules, review                                                  |
| 05  | [API design and the backend layers](05-api-design.md)              | ESLint import boundaries, review                                      |
| 06  | [Frontend (Next.js)](06-frontend.md)                               | ESLint import boundaries, `jsx-a11y`, review                          |
| 07  | [Testing](07-testing.md)                                           | Vitest coverage thresholds, review                                    |
| 08  | [Git, branches, and pull requests](08-git-and-pull-requests.md)    | commitlint, ownership check, branch ruleset, AI review gate           |
| 09  | [Errors, logging, and security](09-errors-logging-and-security.md) | ESLint `no-console`, review                                           |

## Hard limits (lint errors, not suggestions)

| Limit                                          | Value                                 |
| ---------------------------------------------- | ------------------------------------- |
| Lines per file (excluding blanks and comments) | 250                                   |
| Lines per function                             | 60 (tests exempt)                     |
| Parameters per function                        | 3 (use an options object beyond that) |
| Nesting depth                                  | 3                                     |
| Cyclomatic complexity                          | 10                                    |

If code doesn't fit, split it by responsibility. Never disable a rule to make a file pass. `eslint-disable` comments require a `NOTE:` explaining why and tech-lead approval in review.

## Changing a standard

Standards change through a PR from the tech lead that updates the doc and the tooling together. Existing code is migrated in follow-up PRs by each owning agent.
