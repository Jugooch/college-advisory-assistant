/**
 * @file Names campuses from the display entries a schedule-options response carries. Display
 * only: a campus with no entry is shown by its ID with a visible note, never guessed.
 * @module @caa/web/shared/utils/campus-display
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { CampusDisplay } from '@caa/api-contract';

/** Display entries by campus ID. */
export type CampusLookup = ReadonlyMap<string, CampusDisplay>;

/** Said after a campus ID when the response has no name for it. */
export const CAMPUS_NAME_UNAVAILABLE = 'name unavailable';

/**
 * Indexes the response's campus entries by ID.
 *
 * @param campuses - The response's campuses.
 * @returns The lookup.
 */
export function indexCampuses(campuses: readonly CampusDisplay[]): CampusLookup {
  return new Map(campuses.map((campus) => [campus.id, campus]));
}

/**
 * Describes one campus in running text.
 *
 * @param campusId - The campus ID.
 * @param lookup - Display entries by campus ID.
 * @returns The campus name, or the ID followed by a "name unavailable" note.
 */
export function describeCampus(campusId: string, lookup: CampusLookup): string {
  const campus = lookup.get(campusId);
  return campus === undefined ? `${campusId} (${CAMPUS_NAME_UNAVAILABLE})` : campus.name;
}
