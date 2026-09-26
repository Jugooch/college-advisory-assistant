# 03 · Comments and documentation

Comments use one format across the codebase so any file reads the same way. ESLint (`jsdoc` plugin) and `scripts/check-conventions.mjs` enforce the mechanical parts.

## 1. File header (required on every source file)

The first thing in every `.ts`, `.tsx`, and `.mjs` file:

```ts
/**
 * @file One sentence: what this file is responsible for.
 * @module @caa/<package>/<path-without-extension>
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
```

| Tag            | Required                               | Use                                                                    |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `@file`        | Always                                 | A sentence describing the file's single responsibility                 |
| `@module`      | Production code                        | Package-qualified path, for search and review                          |
| `@requirement` | When the file implements a requirement | `FR-xx` / `NFR-xx` from `docs/planning/06`. Repeat the tag for several |
| `@see`         | When a doc defines the behavior        | Repository-relative path                                               |

Test files need only `@file` (and `@requirement` for acceptance tests).

## 2. Doc comments on exports (required)

Every exported function, class, method, interface, type alias, and constant gets a TSDoc block:

```ts
/**
 * Derives the aggregate state using the fixed precedence FAIL, then UNKNOWN, then CONDITIONAL, then PASS.
 *
 * @param states - The state of every check that applies to the plan.
 * @returns The aggregate state. An empty list is NEEDS_VERIFICATION, never VALIDATED.
 * @throws {z.ZodError} When ... (only if the function can throw)
 */
```

Rules:

- The first line is a sentence in the present tense, stating what it does (not how).
- `@param name - description` for every parameter. Destructured props may be documented as one `props` parameter.
- `@returns description` for every non-void function.
- `@throws {Type} when` for every error a caller should expect.
- No types in JSDoc braces for `@param`/`@returns` in TypeScript (the signature has them). `@throws {Type}` is the exception.
- One-line `/** ... */` is fine for types, interfaces, fields, and constants.
- Interface fields get a comment when the name alone doesn't say units, format, or source (for example `/** ISO 8601 with offset. */`).

## 3. Section dividers (optional, for longer files)

Exactly this format, and nothing else:

```ts
// ---- Validation helpers ----
```

If a file needs more than three sections, it probably needs splitting.

## 4. Inline comments

Inline comments explain **why**, not what. If a comment restates the code, delete it. Use a tag when the comment is a warning or a follow-up:

| Tag               | Meaning                                                  | Example                                                              |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `// NOTE:`        | Non-obvious context a reader needs                       | `// NOTE: the audit API returns credits as strings.`                 |
| `// SAFETY:`      | An academic-safety decision. Reviewers check these first | `// SAFETY: no evidence is not a pass.`                              |
| `// SECURITY:`    | An authorization or data-protection decision             | `// SECURITY: tenant comes from the session, never the body.`        |
| `// PERF:`        | A deliberate performance trade-off                       | `// PERF: section list is pre-sorted to make overlap checks linear.` |
| `// TODO(#123):`  | Follow-up work, **must** reference an issue              | `// TODO(#42): support linked labs.`                                 |
| `// FIXME(#123):` | Known defect, **must** reference an issue                |                                                                      |

Any other `// WORD:` tag, a bare TODO, and HACK/XXX fail `pnpm check:conventions`.

## 5. What not to comment

- Commented-out code: delete it; git remembers.
- Change history, author names, dates: git has them.
- Obvious code: `// increment the counter`.

## 6. Markdown documentation

- Each package has a short `README.md` only if its public API needs more than the TSDoc on `index.ts` exports.
- Architecture decisions go in `docs/adr/NNNN-title.md` using `docs/adr/0000-template.md`.
- Planning documents in `docs/planning/` are the approved baseline. Change them only through the change-control process in `docs/planning/04`.
