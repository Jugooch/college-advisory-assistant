/**
 * @file Section data object: one published offering of a course in a term, with its meetings.
 * @module @caa/domain/models/section
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import {
  MeetingLocationKind,
  SectionModality,
  SectionModalitySchema,
} from '../enums/section-modality.enum';
import { CampusIdSchema } from './campus.model';
import { CourseIdSchema } from './course.model';
import { InstitutionIdSchema } from './institution.model';
import { type MeetingPattern, MeetingPatternSchema } from './meeting-pattern.model';
import { TermIdSchema } from './term.model';

/** Branded ID so a section ID can never be passed where another ID is expected. */
export const SectionIdSchema = z.uuid().brand<'SectionId'>();

/** Unique identifier of a {@link Section}. */
export type SectionId = z.infer<typeof SectionIdSchema>;

/** Meeting location kinds each modality forbids. `null` (to be announced) is always allowed. */
const FORBIDDEN_LOCATION_KIND: Readonly<Record<SectionModality, MeetingLocationKind | null>> = {
  [SectionModality.InPerson]: MeetingLocationKind.Online,
  [SectionModality.Hybrid]: null,
  [SectionModality.OnlineSynchronous]: MeetingLocationKind.OnCampus,
  [SectionModality.OnlineAsynchronous]: null,
};

/**
 * Returns whether every meeting's location agrees with the section's modality.
 *
 * @param section - The modality and meetings to compare.
 * @returns `false` when an in-person section has an online meeting, or an online synchronous
 *   section has an on-campus meeting.
 */
function hasMeetingsMatchingModality(section: {
  readonly modality: SectionModality;
  readonly meetings: readonly MeetingPattern[];
}): boolean {
  const forbidden = FORBIDDEN_LOCATION_KIND[section.modality];
  return section.meetings.every((meeting) => meeting.location?.kind !== forbidden);
}

/**
 * Schema for a section, as the registrar schedule feed publishes it (planning/09 §Source
 * authority matrix). Section IDs are tenant-specific.
 *
 * An online asynchronous section has no meetings but still has dates. Every other section has
 * at least one meeting, which may be wholly to be announced.
 */
export const SectionSchema = z
  .object({
    id: SectionIdSchema,
    tenantId: InstitutionIdSchema,
    termId: TermIdSchema,
    courseId: CourseIdSchema,
    /** Section identifier in the source system. Distinct from the internal {@link SectionId}. */
    sourceSectionId: z.string().min(1),
    /** Display code such as `001` or `L01`. Codes repeat across courses, so never identity. */
    sectionCode: z.string().min(1),
    /**
     * Home campus of the section, or `null` when it has none, as for an online section. Travel
     * checks use each meeting's own location, not this field.
     */
    campusId: CampusIdSchema.nullable(),
    modality: SectionModalitySchema,
    // NOTE: date-only on purpose (docs/standards/04 rule 7): section dates are calendar dates
    // in the institution's calendar, with no time of day, so an offset would fabricate data.
    /** First day of the section, `YYYY-MM-DD` in the institution's calendar. */
    startsOn: z.iso.date(),
    /** Last day of the section, `YYYY-MM-DD` in the institution's calendar. Inclusive. */
    endsOn: z.iso.date(),
    /** The section's recurring meetings. Empty only for an online asynchronous section. */
    meetings: z.array(MeetingPatternSchema).readonly(),
  })
  // SAFETY: a section that ends before it starts has no dates, so no date-based check on it
  // would be meaningful.
  .refine((section) => section.startsOn <= section.endsOn, {
    message: 'startsOn must not be later than endsOn',
    path: ['endsOn'],
  })
  // SAFETY: a meeting outside its section's dates would be checked for conflicts on days the
  // section doesn't run, or missed on days it does.
  .refine(
    (section) =>
      section.meetings.every(
        (meeting) => section.startsOn <= meeting.startsOn && meeting.endsOn <= section.endsOn,
      ),
    { message: 'Every meeting must fall within the section dates', path: ['meetings'] },
  )
  // SAFETY: a timed section listed with no meetings would look free of every conflict. An
  // unknown schedule is a meeting with `null` times, never an empty list.
  .refine(
    (section) =>
      (section.modality === SectionModality.OnlineAsynchronous) === (section.meetings.length === 0),
    {
      message: 'Only an ONLINE_ASYNCHRONOUS section has no meetings, and it has none',
      path: ['meetings'],
    },
  )
  // SAFETY: a meeting whose location contradicts the modality would make travel checks depend
  // on which of the two fields the engine read.
  .refine(hasMeetingsMatchingModality, {
    message: 'A meeting location contradicts the section modality',
    path: ['meetings'],
  })
  // SAFETY: an in-person or hybrid section with no campus can't be placed for travel checks.
  .refine(
    (section) =>
      section.campusId !== null ||
      (section.modality !== SectionModality.InPerson &&
        section.modality !== SectionModality.Hybrid),
    { message: 'An IN_PERSON or HYBRID section must name its campus', path: ['campusId'] },
  )
  .readonly();

/** A validated, immutable section. */
export type Section = z.infer<typeof SectionSchema>;

/** Raw input accepted by {@link createSection}. */
export type SectionInput = z.input<typeof SectionSchema>;

/**
 * Creates a validated, immutable section.
 *
 * @param input - Raw section fields.
 * @returns The parsed section.
 * @throws {z.ZodError} When a field or meeting is invalid, the dates are reversed, a meeting
 *   falls outside the section dates, the meeting count contradicts the modality, a meeting
 *   location contradicts the modality, or an in-person or hybrid section has no campus.
 */
export function createSection(input: SectionInput): Section {
  return SectionSchema.parse(input);
}
