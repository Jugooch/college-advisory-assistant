/**
 * @file Dimensions a validation check can evaluate. Each dimension is displayed separately.
 * @module @caa/domain/enums/check-kind
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Dimension a check evaluates. Each dimension is displayed separately (planning/08 §Separate
 * dimensions), so passing one never implies another:
 * - `REQUIREMENT_ALLOCATION`: whether the complete candidate set can be counted toward the
 *   outstanding requirements together, without two courses competing for one credit bucket or
 *   one course being reused where policy forbids it (planning/08 §Candidate formation and
 *   allocation). It says nothing about each course's own applicability.
 * - `CREDIT_LOAD`: whether the candidate set's total credits fall within the term's approved
 *   minimum and maximum load (planning/08 §Constraint formulation). It says nothing about
 *   requirement progress or registration.
 */
export const CheckKind = {
  RequirementApplicability: 'REQUIREMENT_APPLICABILITY',
  RequirementAllocation: 'REQUIREMENT_ALLOCATION',
  Prerequisite: 'PREREQUISITE',
  Corequisite: 'COREQUISITE',
  ScheduleFeasibility: 'SCHEDULE_FEASIBILITY',
  OfferingStatus: 'OFFERING_STATUS',
  SeatEligibility: 'SEAT_ELIGIBILITY',
  CreditLoad: 'CREDIT_LOAD',
  RegistrationReadiness: 'REGISTRATION_READINESS',
} as const;

/** Union of every {@link CheckKind} value. */
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

/** Runtime schema for {@link CheckKind}. */
export const CheckKindSchema = z.enum(CheckKind);
