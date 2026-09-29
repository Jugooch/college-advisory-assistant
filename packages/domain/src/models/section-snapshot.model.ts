/**
 * @file Section snapshot: the immutable, published set of a term's sections that the solver pins.
 * @module @caa/domain/models/section-snapshot
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { type LinkedSectionGroup, LinkedSectionGroupSchema } from './linked-section-group.model';
import { type Section, SectionSchema } from './section.model';
import { TermIdSchema } from './term.model';

/** Branded ID so a section snapshot ID can never be passed where another ID is expected. */
export const SectionSnapshotIdSchema = z.uuid().brand<'SectionSnapshotId'>();

/** Unique identifier of a {@link SectionSnapshot}. */
export type SectionSnapshotId = z.infer<typeof SectionSnapshotIdSchema>;

/**
 * Returns whether no value appears twice.
 *
 * @param values - Values to check.
 * @returns `false` when any value repeats.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Returns whether every section ID a linked-section group names is in the snapshot, and each
 * permitted section belongs to its component's course.
 *
 * @param snapshot - The snapshot's sections and groups.
 * @returns `false` when a group names a missing section or a section of another course.
 */
function hasResolvableLinks(snapshot: {
  readonly sections: readonly Section[];
  readonly linkedSectionGroups: readonly LinkedSectionGroup[];
}): boolean {
  const courseBySection = new Map(
    snapshot.sections.map((section) => [section.id, section.courseId] as const),
  );
  return snapshot.linkedSectionGroups.every(
    (group) =>
      courseBySection.has(group.primarySectionId) &&
      group.components.every((component) =>
        component.permittedSectionIds.every(
          (sectionId) => courseBySection.get(sectionId) === component.courseId,
        ),
      ),
  );
}

/**
 * Schema for a section snapshot: every published section of one tenant's term, and the
 * linked-section groups among them, as of `sourceEffectiveAt`. A snapshot is immutable once
 * published; a newer feed produces a new snapshot with a new ID.
 *
 * The snapshot pins everything the solver reads about sections, including the term dates and
 * the time zone meeting times are local to, so the same snapshot always gives the same result.
 */
export const SectionSnapshotSchema = z
  .object({
    id: SectionSnapshotIdSchema,
    tenantId: InstitutionIdSchema,
    termId: TermIdSchema,
    // NOTE: date-only on purpose (docs/standards/04 rule 7): term boundaries are calendar dates
    // in the institution's calendar. They're copied from the term when the snapshot is
    // published, so the pinned snapshot doesn't change if the term record does.
    /** First day of the term, `YYYY-MM-DD` in the institution's calendar. */
    termStartsOn: z.iso.date(),
    /** Last day of the term, `YYYY-MM-DD` in the institution's calendar. Inclusive. */
    termEndsOn: z.iso.date(),
    /** IANA time zone every meeting time is local to, such as `America/Chicago`. */
    timezone: z.string().min(1),
    /** When the registrar feed's data took effect. ISO 8601 with offset. */
    sourceEffectiveAt: z.iso.datetime({ offset: true }),
    /** The term's sections. Empty means the registrar published none. */
    sections: z.array(SectionSchema).readonly(),
    /** Linked-section groups among the sections. Empty means no section requires another. */
    linkedSectionGroups: z.array(LinkedSectionGroupSchema).readonly(),
  })
  // SAFETY: a term that ends before it starts would place every section outside the term.
  .refine((snapshot) => snapshot.termStartsOn <= snapshot.termEndsOn, {
    message: 'termStartsOn must not be later than termEndsOn',
    path: ['termEndsOn'],
  })
  // SAFETY: section and term IDs are tenant-specific, so a section from another tenant or term
  // would put a schedule the student can't take into the solver's input.
  .refine(
    (snapshot) =>
      snapshot.sections.every(
        (section) => section.tenantId === snapshot.tenantId && section.termId === snapshot.termId,
      ),
    { message: "Every section must belong to the snapshot's tenant and term", path: ['sections'] },
  )
  // SAFETY: a repeated section, internal or source ID, would let one offering be selected twice
  // or give one source row two different meeting lists.
  .refine(
    (snapshot) =>
      isDistinct(snapshot.sections.map((section) => section.id)) &&
      isDistinct(snapshot.sections.map((section) => section.sourceSectionId)),
    { message: 'Section id and sourceSectionId must be unique', path: ['sections'] },
  )
  // SAFETY: a section dated outside its term would be checked against the wrong calendar.
  .refine(
    (snapshot) =>
      snapshot.sections.every(
        (section) =>
          snapshot.termStartsOn <= section.startsOn && section.endsOn <= snapshot.termEndsOn,
      ),
    { message: 'Every section must fall within the term dates', path: ['sections'] },
  )
  // SAFETY: a link group from another tenant would impose another institution's requirement.
  .refine(
    (snapshot) =>
      snapshot.linkedSectionGroups.every((group) => group.tenantId === snapshot.tenantId),
    {
      message: "Every linked-section group must belong to the snapshot's tenant",
      path: ['linkedSectionGroups'],
    },
  )
  // SAFETY: two groups for one primary section would leave its required components ambiguous.
  .refine(
    (snapshot) =>
      isDistinct(snapshot.linkedSectionGroups.map((group) => group.id)) &&
      isDistinct(snapshot.linkedSectionGroups.map((group) => group.primarySectionId)),
    {
      message: 'Linked-section group id and primarySectionId must be unique',
      path: ['linkedSectionGroups'],
    },
  )
  // SAFETY: a link to a section that isn't published, or to another course's section, can't be
  // satisfied as the registrar defined it. An empty permitted list is the valid way to say so.
  .refine(hasResolvableLinks, {
    message: "Every linked section must be in the snapshot and belong to its component's course",
    path: ['linkedSectionGroups'],
  })
  .readonly();

/** A validated, immutable section snapshot. */
export type SectionSnapshot = z.infer<typeof SectionSnapshotSchema>;

/** Raw input accepted by {@link createSectionSnapshot}. */
export type SectionSnapshotInput = z.input<typeof SectionSnapshotSchema>;

/**
 * Creates a validated, immutable section snapshot.
 *
 * @param input - Raw snapshot fields.
 * @returns The parsed section snapshot.
 * @throws {z.ZodError} When a section or group is invalid, the term dates are reversed, a
 *   section belongs to another tenant or term or falls outside the term, a section `id` or
 *   `sourceSectionId` repeats, a group belongs to another tenant or repeats a primary section,
 *   or a group names a section that isn't in the snapshot or belongs to another course.
 */
export function createSectionSnapshot(input: SectionSnapshotInput): SectionSnapshot {
  return SectionSnapshotSchema.parse(input);
}
