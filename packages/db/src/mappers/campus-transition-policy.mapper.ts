/**
 * @file Converts a campus transition version and its pairs into a domain policy.
 * @module @caa/db/mappers/campus-transition-policy
 * @requirement FR-07
 */
import { type CampusTransitionPolicy, createCampusTransitionPolicy } from '@caa/domain';

import type {
  CampusTransitionRow,
  CampusTransitionVersionRow,
} from '../tables/campus-transition.table';

/**
 * Maps a version row and its pair rows to a validated domain object.
 *
 * @param row - Row read from the `campus_transition_version` table.
 * @param transitionRows - Its `campus_transition` rows.
 * @returns The domain policy. Only the stored pairs are listed; any other pair of different
 *   campuses stays unknown, never zero.
 * @throws {z.ZodError} When the stored policy violates the domain schema.
 */
export function toCampusTransitionPolicy(
  row: CampusTransitionVersionRow,
  transitionRows: readonly CampusTransitionRow[],
): CampusTransitionPolicy {
  return createCampusTransitionPolicy({
    tenantId: row.tenantId,
    version: row.version,
    transitions: transitionRows.map(({ fromCampusId, toCampusId, minutes }) => ({
      fromCampusId,
      toCampusId,
      minutes,
    })),
  });
}
