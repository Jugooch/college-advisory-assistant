/**
 * @file Builds synthetic roster rows for tests.
 * @module @caa/test-kit/builders/roster-row
 */
import { createRosterRow, type RosterRow, type RosterRowInput } from '@caa/domain';

import { syntheticSourceStudentId } from '../fixtures/synthetic-id';

/**
 * Builds a valid roster row, defaulting to an insert-or-update (not a tombstone) at version 1.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes rows; drives the default `sourceStudentId`.
 * @returns A validated roster row.
 */
export function buildRosterRow(overrides: Partial<RosterRowInput> = {}, seed = 1): RosterRow {
  return createRosterRow({
    sourceStudentId: syntheticSourceStudentId(seed),
    recordVersion: 1,
    isDeleted: false,
    ...overrides,
  });
}
