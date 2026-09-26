/**
 * @file Check result data object: one validation check and the evidence behind it.
 * @module @caa/domain/models/check-result
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { CheckState, CheckStateSchema } from '../enums/check-state.enum';

/** Dimension a check evaluates. Each dimension is displayed separately. */
export const CheckKind = {
  RequirementApplicability: 'requirement_applicability',
  Prerequisite: 'prerequisite',
  Corequisite: 'corequisite',
  ScheduleFeasibility: 'schedule_feasibility',
  OfferingStatus: 'offering_status',
  SeatEligibility: 'seat_eligibility',
  RegistrationReadiness: 'registration_readiness',
} as const;

/** Union of every {@link CheckKind} value. */
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

/** Runtime schema for {@link CheckKind}. */
export const CheckKindSchema = z.enum(CheckKind);

/** Schema for a single validation check result. */
export const CheckResultSchema = z
  .object({
    kind: CheckKindSchema,
    state: CheckStateSchema,
    reasonCode: z.string().min(1).optional(),
    sourceRef: z.string().min(1).optional(),
  })
  // SAFETY: anything short of PASS must say why, so the UI never shows an unexplained state.
  .refine((check) => check.state === CheckState.Pass || check.reasonCode !== undefined, {
    message: 'Non-passing checks require a reasonCode',
    path: ['reasonCode'],
  })
  .readonly();

/** A validated, immutable check result. */
export type CheckResult = z.infer<typeof CheckResultSchema>;

/** Raw input accepted by {@link createCheckResult}. */
export type CheckResultInput = z.input<typeof CheckResultSchema>;

/**
 * Creates a validated, immutable check result.
 *
 * @param input - Raw check fields.
 * @returns The parsed check result.
 * @throws {z.ZodError} When a field is invalid or a non-passing check has no reasonCode.
 */
export function createCheckResult(input: CheckResultInput): CheckResult {
  return CheckResultSchema.parse(input);
}
