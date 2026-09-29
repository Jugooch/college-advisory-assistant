/**
 * @file Builds synthetic section snapshots: the pinned, published sections of one term.
 * @module @caa/test-kit/builders/section-snapshot
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  createSectionSnapshot,
  type SectionSnapshot,
  type SectionSnapshotInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_SCHEDULE_TERM } from '../fixtures/synthetic-schedule-term';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid section snapshot of tenant A's `SYNTHETIC_SCHEDULE_TERM` (2027SP, 2027-01-11
 * to 2027-05-07, `America/Chicago`), published by the registrar feed at 2026-09-20 06:00 -05:00.
 *
 * By default it lists **no sections and no linked-section groups**, which means the registrar
 * published none. That is the conservative default: every requested course then lacks section
 * data, never an assumed schedule. Override `sections` and `linkedSectionGroups` with what the
 * case lists.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes snapshots; drives the default `id`.
 * @returns A validated section snapshot.
 */
export function buildSectionSnapshot(
  overrides: Partial<SectionSnapshotInput> = {},
  seed = 1,
): SectionSnapshot {
  return createSectionSnapshot({
    id: syntheticId('sectionSnapshot', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    termId: SYNTHETIC_SCHEDULE_TERM.termId,
    termStartsOn: SYNTHETIC_SCHEDULE_TERM.startsOn,
    termEndsOn: SYNTHETIC_SCHEDULE_TERM.endsOn,
    timezone: SYNTHETIC_SCHEDULE_TERM.timezone,
    sourceEffectiveAt: '2026-09-20T06:00:00.000-05:00',
    sections: [],
    linkedSectionGroups: [],
    ...overrides,
  });
}
