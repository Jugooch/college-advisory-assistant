/**
 * @file Conflict set: the verified hard-rule failures behind a `NO_FEASIBLE_PLAN` outcome.
 * @module @caa/api-contract/contracts/schedule-conflict-set
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { CheckKind, CheckResultSchema, CheckState } from '@caa/domain';

/** Most conflicts a `conflictSet` lists; the rest are counted in `omittedCount`. */
export const MAX_CONFLICT_SET_ITEMS = 20;

/**
 * Verified conflicts behind `NO_FEASIBLE_PLAN`: distinct FAIL results the solver's checks
 * produced on the pinned inputs. It is never described as minimal, because minimality isn't
 * checked (planning/08 §Constraint formulation).
 */
export const ConflictSetSchema = z
  .object({
    items: z
      .array(
        CheckResultSchema.refine(
          (check) =>
            check.state === CheckState.Fail &&
            (check.kind === CheckKind.ScheduleFeasibility || check.kind === CheckKind.CreditLoad),
          { message: 'A conflict is a FAIL SCHEDULE_FEASIBILITY or CREDIT_LOAD check' },
        ),
      )
      .min(1)
      .max(MAX_CONFLICT_SET_ITEMS)
      .readonly(),
    /** Always `false` in S4: the set is verified, not proven minimal. */
    isMinimal: z.literal(false),
    /** Conflicts left out after the first {@link MAX_CONFLICT_SET_ITEMS}. */
    omittedCount: z.number().int().nonnegative(),
  })
  .readonly();

/** Verified conflicts behind `NO_FEASIBLE_PLAN`. */
export type ConflictSet = z.infer<typeof ConflictSetSchema>;
