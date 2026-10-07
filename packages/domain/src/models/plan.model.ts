/**
 * @file Plan data object: a student's draft plan for one term. Revisions are append-only.
 * @module @caa/domain/models/plan
 * @requirement FR-11
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { StudentIdSchema } from './student.model';
import { TermIdSchema } from './term.model';

/** Branded ID so a plan ID can never be passed where another ID is expected. */
export const PlanIdSchema = z.uuid().brand<'PlanId'>();

/** Unique identifier of a {@link Plan}. */
export type PlanId = z.infer<typeof PlanIdSchema>;

/** Schema for a plan: one per student per term (ADR-0013 §1). */
export const PlanSchema = z
  .strictObject({
    id: PlanIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    termId: TermIdSchema,
    /** When the plan was first saved. ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/** A validated, immutable plan. */
export type Plan = z.infer<typeof PlanSchema>;
