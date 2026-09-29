/**
 * @file How a section is delivered, and where its meetings take place.
 * @module @caa/domain/enums/section-modality
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Delivery mode of a section, as the registrar schedule feed publishes it.
 *
 * - `IN_PERSON`: every meeting is on a campus.
 * - `HYBRID`: meetings are a mix of on-campus and online.
 * - `ONLINE_SYNCHRONOUS`: real, timed meetings, all online.
 * - `ONLINE_ASYNCHRONOUS`: no timed meetings, but the section still has dates.
 */
export const SectionModality = {
  InPerson: 'IN_PERSON',
  Hybrid: 'HYBRID',
  OnlineSynchronous: 'ONLINE_SYNCHRONOUS',
  OnlineAsynchronous: 'ONLINE_ASYNCHRONOUS',
} as const;

/** Union of every {@link SectionModality} value. */
export type SectionModality = (typeof SectionModality)[keyof typeof SectionModality];

/** Runtime schema for {@link SectionModality}. */
export const SectionModalitySchema = z.enum(SectionModality);

/** Where one meeting takes place. */
export const MeetingLocationKind = {
  OnCampus: 'ON_CAMPUS',
  Online: 'ONLINE',
} as const;

/** Union of every {@link MeetingLocationKind} value. */
export type MeetingLocationKind = (typeof MeetingLocationKind)[keyof typeof MeetingLocationKind];

/** Runtime schema for {@link MeetingLocationKind}. */
export const MeetingLocationKindSchema = z.enum(MeetingLocationKind);
