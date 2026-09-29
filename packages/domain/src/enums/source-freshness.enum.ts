/**
 * @file Whether the academic sources behind a result were within their maximum age.
 * @module @caa/domain/enums/source-freshness
 * @requirement FR-09
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Freshness of the student record and audit behind a result, as the server judged it against
 * the maximum source age (planning/09 §Proposed freshness policies; standard 05 §Source
 * freshness).
 *
 * - `CURRENT`: every source time was within the maximum age when it was judged.
 * - `HISTORICAL`: at least one source time was past the maximum age, too far in the future, or
 *   missing. The data is a historical view only and must be refreshed before any new validated
 *   recommendation. It is never shown as current standing.
 */
export const SourceFreshness = {
  Current: 'CURRENT',
  Historical: 'HISTORICAL',
} as const;

/** Union of every {@link SourceFreshness} value. */
export type SourceFreshness = (typeof SourceFreshness)[keyof typeof SourceFreshness];

/** Runtime schema for {@link SourceFreshness}. */
export const SourceFreshnessSchema = z.enum(SourceFreshness);
