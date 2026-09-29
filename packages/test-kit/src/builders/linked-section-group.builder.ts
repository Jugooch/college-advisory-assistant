/**
 * @file Builds synthetic linked-section groups: a primary section and the sections it requires.
 * @module @caa/test-kit/builders/linked-section-group
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  createLinkedSectionGroup,
  type LinkedSectionComponent,
  LinkedSectionComponentSchema,
  type LinkedSectionGroup,
  type LinkedSectionGroupInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/** Raw input accepted by {@link buildLinkedSectionComponent}. */
export type LinkedSectionComponentInput = LinkedSectionGroupInput['components'][number];

/**
 * Builds a valid linked-section component named `Lab` of course seed 2, permitting section
 * seeds 2 and 3: the student takes exactly one of them.
 *
 * @param overrides - Fields to replace in the default. An empty `permittedSectionIds` is valid
 *   data that the engine reports as UNKNOWN (`LINKED_SECTION_UNAVAILABLE`).
 * @returns A validated linked-section component.
 */
export function buildLinkedSectionComponent(
  overrides: Partial<LinkedSectionComponentInput> = {},
): LinkedSectionComponent {
  return LinkedSectionComponentSchema.parse({
    name: 'Lab',
    courseId: syntheticId('course', 2),
    permittedSectionIds: [syntheticId('section', 2), syntheticId('section', 3)],
    ...overrides,
  });
}

/**
 * Builds a valid linked-section group of tenant A: primary section seed 1 (`buildSection()`)
 * requires one {@link buildLinkedSectionComponent} lab, section seed 2 or 3 of course seed 2.
 * This is the shape of AC06, a lecture with a required lab.
 *
 * A section snapshot accepts the group only when it holds every section the group names, each
 * in its component's course.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes groups; drives the default `id`.
 * @returns A validated linked-section group.
 */
export function buildLinkedSectionGroup(
  overrides: Partial<LinkedSectionGroupInput> = {},
  seed = 1,
): LinkedSectionGroup {
  return createLinkedSectionGroup({
    id: syntheticId('linkedSectionGroup', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    primarySectionId: syntheticId('section', 1),
    components: [buildLinkedSectionComponent()],
    ...overrides,
  });
}
