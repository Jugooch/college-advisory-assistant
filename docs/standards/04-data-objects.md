# 04 · Data objects

Every data object is defined once, in `packages/domain`, as a Zod schema. Types are inferred from the schema, never written by hand alongside it. Other layers reuse the schema.

## Anatomy of a model file

`packages/domain/src/models/<name>.model.ts`, in this order:

```ts
/**
 * @file Plan revision data object: a saved, validated set of sections for one term.
 * @module @caa/domain/models/plan-revision
 * @requirement FR-11
 */
import { z } from 'zod';

/** Branded ID so a plan revision ID can't be passed where another ID is expected. */
export const PlanRevisionIdSchema = z.uuid().brand<'PlanRevisionId'>();

/** Unique identifier of a {@link PlanRevision}. */
export type PlanRevisionId = z.infer<typeof PlanRevisionIdSchema>;

/** Schema for a plan revision. */
export const PlanRevisionSchema = z
  .object({
    id: PlanRevisionIdSchema,
    tenantId: InstitutionIdSchema,
    revision: z.number().int().positive(),
    sectionIds: z.array(SectionIdSchema).readonly(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/** A validated, immutable plan revision. */
export type PlanRevision = z.infer<typeof PlanRevisionSchema>;

/** Raw input accepted by {@link createPlanRevision}. */
export type PlanRevisionInput = z.input<typeof PlanRevisionSchema>;

/**
 * Creates a validated, immutable plan revision.
 *
 * @param input - Raw fields.
 * @returns The parsed plan revision.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createPlanRevision(input: PlanRevisionInput): PlanRevision {
  return PlanRevisionSchema.parse(input);
}
```

## Rules

1. **Schema first.** `XxxSchema` is the source of truth; `type Xxx = z.infer<typeof XxxSchema>`.
2. **Immutable.** Finish object schemas with `.readonly()`. To change a value, create a new object with the factory.
3. **Factories validate.** Objects are created only through `createXxx(input)` (or by parsing with the schema at a boundary). Never build a domain object with a bare object literal and a cast.
4. **Invariants live in the schema.** Cross-field rules use `.refine` with a `SAFETY:` comment when academic meaning is involved (see `check-result.model.ts`).
5. **Branded IDs.** Every entity ID is `z.uuid().brand<'XxxId'>()`. Internal IDs are distinct from source-system IDs, which are plain strings named `sourceXxxId`.
6. **Tenant field.** Every tenant-scoped object has `tenantId: InstitutionId`.
7. **Dates and times** are ISO 8601 strings with offset (`z.iso.datetime({ offset: true })`). `Date` objects exist only inside the db layer and are converted by mappers.
   - **Calendar dates** with no time of day, such as term boundaries, are `z.iso.date()` (`YYYY-MM-DD`). Adding a time or offset would fabricate data. A `// NOTE:` on the field says why it is date-only and whose calendar it's in, for example "the institution's calendar".
   - `YYYY-MM-DD` strings compare correctly as strings. Turning a calendar date into an instant needs the tenant's time zone as data, never an assumed one.
   - The db layer keeps a calendar date as a string (a `date` column in string mode), never a `Date`.
8. **Credits and other exact quantities** are scaled integers (for example `creditsTimes100: 350` for 3.5 credits) or decimal strings. Never floating point. The unit goes in the field name or doc comment.
9. **Enums** are `as const` objects in `enums/<name>.enum.ts`:
   ```ts
   export const CheckState = { Pass: 'PASS', Fail: 'FAIL' } as const;
   export type CheckState = (typeof CheckState)[keyof typeof CheckState];
   export const CheckStateSchema = z.enum(CheckState);
   ```
10. **Unknown is explicit.** A value the source didn't supply is `null` with a documented meaning, never an empty string, `0`, or an omitted field that readers must guess about.
11. **No behavior in models.** Models are data plus validation. Logic that interprets data belongs in the engine or a service. The one exception is a shared invariant: a single pure rule that the engine produces and a schema must also enforce. It lives beside its type, and the engine calls it instead of restating it (standard 01 §Shared invariants, ADR-0005).

## The same object across layers

| Layer        | Shape                                                                 | Converted by                                                                                                            |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Database row | `XxxRow` (Drizzle `$inferSelect`), `Date` objects, snake_case columns | `packages/db/src/mappers/xxx.mapper.ts` → `toXxx(row)`                                                                  |
| Domain       | `Xxx` (this package)                                                  | —                                                                                                                       |
| API contract | `XxxResponse` / `CreateXxxRequest` in `packages/api-contract`         | `apps/api/src/modules/*/*.mapper.ts` when the shapes differ; otherwise the contract composes the domain schema directly |
| Web          | Uses the contract types only                                          | —                                                                                                                       |

Rows never leave `packages/db`. Web code never imports domain _factories_ or shared invariants (it may import types and enums for display).

## Contract DTO naming

Request and response schemas in `packages/api-contract` end in `RequestSchema` / `ResponseSchema`: `CreatePlanRequestSchema`, `PlanResponseSchema`. Domain models never carry these suffixes.
