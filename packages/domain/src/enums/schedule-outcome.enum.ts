/**
 * @file Outcome of a schedule-options search, and the fixed limitations every response states.
 * @module @caa/domain/enums/schedule-outcome
 * @requirement FR-18
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

/**
 * What a schedule-options search found (ADR-0010 §5). Each is a valid, verified answer, sent
 * in a 200 response, never as an error:
 * - `OPTIONS_FOUND`: one to three options. If the work cap was reached, the search is
 *   incomplete, and the options are neither claimed best nor the only ones.
 * - `NO_FEASIBLE_PLAN`: proven on known data. Every candidate broke a hard rule; the verified
 *   conflicts are listed.
 * - `SEARCH_TIMEOUT`: the work cap was reached before any candidate was found. Never reported
 *   as infeasible.
 * - `NEEDS_VERIFICATION`: a requested course has no candidate because section data is missing,
 *   so the search didn't run; the UNKNOWN results say what is missing.
 */
export const ScheduleOutcome = {
  OptionsFound: 'OPTIONS_FOUND',
  NoFeasiblePlan: 'NO_FEASIBLE_PLAN',
  SearchTimeout: 'SEARCH_TIMEOUT',
  NeedsVerification: 'NEEDS_VERIFICATION',
} as const;

/** Union of every {@link ScheduleOutcome} value. */
export type ScheduleOutcome = (typeof ScheduleOutcome)[keyof typeof ScheduleOutcome];

/** Runtime schema for {@link ScheduleOutcome}. */
export const ScheduleOutcomeSchema = z.enum(ScheduleOutcome);

/**
 * What a schedule option does not establish, as fixed codes rather than free text (ADR-0010 §5).
 * Every schedule-options response lists all of them:
 * - `SEAT_AVAILABILITY_NOT_CHECKED`: open seats and reserved-seat rules weren't checked.
 * - `REGISTRATION_READINESS_NOT_CHECKED`: holds, time tickets, and other registration
 *   conditions weren't checked.
 * - `NOT_REGISTERED`: planning registers nothing; the student isn't enrolled in any section.
 */
export const ScheduleLimitation = {
  SeatAvailabilityNotChecked: 'SEAT_AVAILABILITY_NOT_CHECKED',
  RegistrationReadinessNotChecked: 'REGISTRATION_READINESS_NOT_CHECKED',
  NotRegistered: 'NOT_REGISTERED',
} as const;

/** Union of every {@link ScheduleLimitation} value. */
export type ScheduleLimitation = (typeof ScheduleLimitation)[keyof typeof ScheduleLimitation];

/** Runtime schema for {@link ScheduleLimitation}. */
export const ScheduleLimitationSchema = z.enum(ScheduleLimitation);
