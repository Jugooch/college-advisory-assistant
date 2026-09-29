/**
 * @file Builds synthetic sections for tests: in person, half-term and online asynchronous.
 * @module @caa/test-kit/builders/section
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { createSection, type Section, type SectionInput, SectionModality } from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../fixtures/synthetic-campuses';
import { syntheticId } from '../fixtures/synthetic-id';
import {
  SYNTHETIC_SCHEDULE_TERM,
  type SyntheticTermHalf,
} from '../fixtures/synthetic-schedule-term';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { buildHalfTermMeeting, buildMeetingPattern } from './meeting-pattern.builder';

/**
 * Builds a valid in-person section of course seed 1 (`buildCourse()`'s course) in tenant A's
 * `SYNTHETIC_SCHEDULE_TERM` (2027SP), on `SYNTHETIC_CAMPUSES.north`, running the whole term with
 * one `buildMeetingPattern()` meeting (MWF 09:00 to 09:50).
 *
 * The default section code is the seed padded to three digits (`001`), and the source ID is
 * `DEMO-SEC-` plus that code. Two default sections of different seeds meet at the same time, so
 * a test never gets a conflict-free pair by accident.
 *
 * @param overrides - Fields to replace in the default. Section dates and meetings are replaced
 *   as given, so override them together.
 * @param seed - Distinguishes sections; drives the default `id`, `sourceSectionId` and
 *   `sectionCode`.
 * @returns A validated section.
 */
export function buildSection(overrides: Partial<SectionInput> = {}, seed = 1): Section {
  const code = String(seed).padStart(3, '0');
  return createSection({
    id: syntheticId('section', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    termId: SYNTHETIC_SCHEDULE_TERM.termId,
    courseId: syntheticId('course', 1),
    sourceSectionId: `DEMO-SEC-${code}`,
    sectionCode: code,
    campusId: SYNTHETIC_CAMPUSES.north.id,
    modality: SectionModality.InPerson,
    startsOn: SYNTHETIC_SCHEDULE_TERM.startsOn,
    endsOn: SYNTHETIC_SCHEDULE_TERM.endsOn,
    meetings: [buildMeetingPattern()],
    ...overrides,
  });
}

/**
 * Builds a section that runs in one half of `SYNTHETIC_SCHEDULE_TERM`, with one MWF 09:00 to
 * 09:50 meeting in that half (`buildHalfTermMeeting`), otherwise like {@link buildSection}.
 *
 * @param half - Which half of the term the section runs in.
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes sections, as for {@link buildSection}.
 * @returns A validated section.
 */
export function buildHalfTermSection(
  half: SyntheticTermHalf,
  overrides: Partial<SectionInput> = {},
  seed = 1,
): Section {
  return buildSection(
    {
      ...SYNTHETIC_SCHEDULE_TERM.halves[half],
      meetings: [buildHalfTermMeeting(half)],
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds an online asynchronous section: no campus and no timed meetings, but it still has
 * dates, the whole of `SYNTHETIC_SCHEDULE_TERM` (planning/08 §Schedule model). Otherwise like
 * {@link buildSection}.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes sections, as for {@link buildSection}.
 * @returns A validated section.
 */
export function buildOnlineAsynchronousSection(
  overrides: Partial<SectionInput> = {},
  seed = 1,
): Section {
  return buildSection(
    {
      campusId: null,
      modality: SectionModality.OnlineAsynchronous,
      meetings: [],
      ...overrides,
    },
    seed,
  );
}
