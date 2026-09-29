/**
 * @file Linked-section group: the sections a student must take together with a primary section.
 * @module @caa/domain/models/linked-section-group
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { CourseIdSchema } from './course.model';
import { InstitutionIdSchema } from './institution.model';
import { SectionIdSchema } from './section.model';

/** Branded ID so a linked-section group ID can never be passed where another ID is expected. */
export const LinkedSectionGroupIdSchema = z.uuid().brand<'LinkedSectionGroupId'>();

/** Unique identifier of a {@link LinkedSectionGroup}. */
export type LinkedSectionGroupId = z.infer<typeof LinkedSectionGroupIdSchema>;

/**
 * Schema for one required component of a linked-section group: the student must take exactly
 * one of its permitted sections. For example, a lab component permits `L01` or `L02`.
 *
 * An empty `permittedSectionIds` list is valid data: the registrar published the requirement
 * but no section that satisfies it. The engine reports that as UNKNOWN, never as satisfied.
 */
export const LinkedSectionComponentSchema = z
  .object({
    /** Display name of the component, such as `Lab` or `Recitation`. Never used as identity. */
    name: z.string().min(1),
    /** Course the permitted sections belong to. May differ from the primary section's course. */
    courseId: CourseIdSchema,
    /** Sections that satisfy this component; the student takes exactly one of them. */
    permittedSectionIds: z.array(SectionIdSchema).readonly(),
  })
  .refine(
    (component) =>
      new Set(component.permittedSectionIds).size === component.permittedSectionIds.length,
    { message: 'permittedSectionIds must not repeat a section', path: ['permittedSectionIds'] },
  )
  .readonly();

/** A validated, immutable linked-section component. */
export type LinkedSectionComponent = z.infer<typeof LinkedSectionComponentSchema>;

/**
 * Schema for a linked-section group: a primary section and the components that must be taken
 * with it. A group may span two catalog courses, such as `DEMO-PHYS 301` section `001`, which
 * requires one of `DEMO-PHYS 301L` sections `L01` or `L02`.
 *
 * Which sections the IDs refer to is checked by the section snapshot that holds the group.
 */
export const LinkedSectionGroupSchema = z
  .object({
    id: LinkedSectionGroupIdSchema,
    tenantId: InstitutionIdSchema,
    /** Section whose selection requires every component. */
    primarySectionId: SectionIdSchema,
    /** Components the student must satisfy, each with one section. At least one. */
    components: z.array(LinkedSectionComponentSchema).min(1).readonly(),
  })
  // SAFETY: a primary section that satisfies its own component would let the engine count the
  // requirement as met without the student taking any linked section.
  .refine(
    (group) =>
      group.components.every(
        (component) => !component.permittedSectionIds.includes(group.primarySectionId),
      ),
    { message: 'The primary section must not be a permitted section', path: ['components'] },
  )
  // SAFETY: one section in two components would let a single selection satisfy two separate
  // requirements.
  .refine(
    (group) => {
      const ids = group.components.flatMap((component) => component.permittedSectionIds);
      return new Set(ids).size === ids.length;
    },
    { message: 'A section may be permitted by only one component', path: ['components'] },
  )
  .readonly();

/** A validated, immutable linked-section group. */
export type LinkedSectionGroup = z.infer<typeof LinkedSectionGroupSchema>;

/** Raw input accepted by {@link createLinkedSectionGroup}. */
export type LinkedSectionGroupInput = z.input<typeof LinkedSectionGroupSchema>;

/**
 * Creates a validated, immutable linked-section group.
 *
 * @param input - Raw group fields.
 * @returns The parsed linked-section group.
 * @throws {z.ZodError} When a field is invalid, there are no components, a component repeats a
 *   section, the primary section is permitted, or two components permit the same section.
 */
export function createLinkedSectionGroup(input: LinkedSectionGroupInput): LinkedSectionGroup {
  return LinkedSectionGroupSchema.parse(input);
}
