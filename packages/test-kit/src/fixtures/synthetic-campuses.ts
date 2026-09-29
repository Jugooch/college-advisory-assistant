/**
 * @file The two fixed synthetic campuses of tenant A, so tests and golden cases can name them.
 * @module @caa/test-kit/fixtures/synthetic-campuses
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { Campus } from '@caa/domain';

import { buildCampus } from '../builders/campus.builder';

/**
 * Fixed synthetic campuses of tenant A. Both are fictional.
 *
 * | Key     | Name              | Source ID    | ID                                     |
 * | ------- | ----------------- | ------------ | -------------------------------------- |
 * | `north` | Demo North Campus | `DEMO-NORTH` | `d0000000-0000-4000-8000-000000000001` |
 * | `south` | Demo South Campus | `DEMO-SOUTH` | `d0000000-0000-4000-8000-000000000002` |
 *
 * Section and meeting builders place meetings on `north` by default. No transition time between
 * the two is implied: a campus transition policy lists only the pairs a test states.
 */
export const SYNTHETIC_CAMPUSES: Readonly<{ north: Campus; south: Campus }> = {
  north: buildCampus({ sourceCampusId: 'DEMO-NORTH', name: 'Demo North Campus' }, 1),
  south: buildCampus({ sourceCampusId: 'DEMO-SOUTH', name: 'Demo South Campus' }, 2),
};
