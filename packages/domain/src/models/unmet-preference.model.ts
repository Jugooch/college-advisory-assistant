/**
 * @file Unmet preference: which preferred constraint a schedule option misses, and where.
 * @module @caa/domain/models/unmet-preference
 * @requirement FR-08
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import {
  ScheduleConstraintKind,
  ScheduleConstraintKindSchema,
} from '../enums/schedule-constraint.enum';
import { SectionIdSchema } from './section.model';

/** Whether a miss of each kind names a section, and whether it names one of its meetings. */
const LOCATION_BY_KIND: Readonly<
  Record<ScheduleConstraintKind, { readonly hasSection: boolean; readonly hasMeeting: boolean }>
> = {
  [ScheduleConstraintKind.UnavailableTime]: { hasSection: true, hasMeeting: true },
  [ScheduleConstraintKind.CreditRange]: { hasSection: false, hasMeeting: false },
  [ScheduleConstraintKind.AllowedModalities]: { hasSection: true, hasMeeting: false },
  [ScheduleConstraintKind.AllowedCampuses]: { hasSection: true, hasMeeting: true },
};

/**
 * Schema for one preferred constraint a schedule option misses, rendered from these structured
 * fields and never from free text (FR-10). An option that misses a preference in several places
 * has one entry for each place.
 *
 * Where the miss is:
 * - `UNAVAILABLE_TIME` and `ALLOWED_CAMPUSES`: a section and the index of its meeting.
 * - `ALLOWED_MODALITIES`: a section, with no meeting.
 * - `CREDIT_RANGE`: the option as a whole, so no section and no meeting.
 */
export const UnmetPreferenceSchema = z
  .object({
    /** Index of the preference in the request's constraint list. */
    constraintIndex: z.number().int().nonnegative(),
    /** The preference's priority rank, 1 first, as the student stated it. */
    priorityRank: z.number().int().positive(),
    kind: ScheduleConstraintKindSchema,
    /** The section that misses the preference, or `null` when the whole option misses it. */
    sectionId: SectionIdSchema.nullable(),
    /** Index of the section's meeting that misses it, or `null` when no single meeting does. */
    meetingIndex: z.number().int().nonnegative().nullable(),
    /**
     * `true` when the preference counts as missed only because a value it depends on is to be
     * announced, such as a meeting time. A preference that depends on unknown data is never
     * counted as met (ADR-0010 §4); this lets the UI say "unknown" rather than "missed".
     */
    isDataUnknown: z.boolean(),
  })
  // SAFETY: the UI names where the preference is missed; a location that doesn't fit the kind
  // would point the student at the wrong section or meeting.
  .refine(
    (unmet) =>
      (unmet.sectionId !== null) === LOCATION_BY_KIND[unmet.kind].hasSection &&
      (unmet.meetingIndex !== null) === LOCATION_BY_KIND[unmet.kind].hasMeeting,
    {
      message: 'sectionId and meetingIndex must match what the constraint kind restricts',
      path: ['sectionId'],
    },
  )
  .readonly();

/** A validated, immutable unmet preference. */
export type UnmetPreference = z.infer<typeof UnmetPreferenceSchema>;

/** Raw input accepted by {@link createUnmetPreference}. */
export type UnmetPreferenceInput = z.input<typeof UnmetPreferenceSchema>;

/**
 * Creates a validated, immutable unmet preference.
 *
 * @param input - Raw fields.
 * @returns The parsed unmet preference.
 * @throws {z.ZodError} When a field is invalid, or the section and meeting don't fit the kind.
 */
export function createUnmetPreference(input: UnmetPreferenceInput): UnmetPreference {
  return UnmetPreferenceSchema.parse(input);
}
