/**
 * @file Dimensions a validation check can evaluate. Each dimension is displayed separately.
 * @module @caa/domain/enums/check-kind
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/** Dimension a check evaluates. Each dimension is displayed separately. */
export const CheckKind = {
  RequirementApplicability: 'REQUIREMENT_APPLICABILITY',
  Prerequisite: 'PREREQUISITE',
  Corequisite: 'COREQUISITE',
  ScheduleFeasibility: 'SCHEDULE_FEASIBILITY',
  OfferingStatus: 'OFFERING_STATUS',
  SeatEligibility: 'SEAT_ELIGIBILITY',
  RegistrationReadiness: 'REGISTRATION_READINESS',
} as const;

/** Union of every {@link CheckKind} value. */
export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];

/** Runtime schema for {@link CheckKind}. */
export const CheckKindSchema = z.enum(CheckKind);
