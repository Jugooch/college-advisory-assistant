/**
 * @file Expands a section into every set of sections its linked-section groups require with it.
 * @module @caa/engine/scheduling/expand-linked-sections
 * @requirement FR-07
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  createScheduleIssue,
  type LinkedSectionComponent,
  type LinkedSectionGroup,
  ReasonCode,
  type ScheduleIssue,
  type Section,
  type SectionId,
  type SectionSnapshot,
} from '@caa/domain';

import { ScheduleInputError } from './schedule-input-error';
import { compareText } from './tie-break-key';

/** A snapshot's sections and linked groups, indexed for lookups. */
export interface LinkIndex {
  readonly sectionsById: ReadonlyMap<SectionId, Section>;
  readonly groupsByPrimary: ReadonlyMap<SectionId, LinkedSectionGroup>;
}

/** What expanding one section found. */
export interface LinkedExpansion {
  /** Every way to take the section with all its required linked sections, the section first. */
  readonly sectionLists: readonly (readonly Section[])[];
  /** A `LINKED_SECTION_UNAVAILABLE` issue for each required component with no section. */
  readonly unavailable: readonly ScheduleIssue[];
}

/**
 * Indexes a snapshot's sections by ID and its linked groups by primary section.
 *
 * @param snapshot - The sections and linked groups.
 * @returns The lookups.
 */
export function indexLinks(
  snapshot: Pick<SectionSnapshot, 'sections' | 'linkedSectionGroups'>,
): LinkIndex {
  return {
    sectionsById: new Map(snapshot.sections.map((section) => [section.id, section] as const)),
    groupsByPrimary: new Map(
      snapshot.linkedSectionGroups.map((group) => [group.primarySectionId, group] as const),
    ),
  };
}

/**
 * Expands a section into every combination of the linked sections it requires: exactly one
 * permitted section per component, each expanded in turn when it is a group's primary.
 *
 * @param section - The section to expand.
 * @param index - The snapshot's lookups.
 * @param path - Sections already being expanded above this one, to detect a cycle.
 * @returns The section lists, or none with the issues when a required component has no
 *   section.
 * @throws {ScheduleInputError} When groups require each other in a cycle (`linkCycle`).
 */
export function expandLinkedSections(
  section: Section,
  index: LinkIndex,
  path: readonly SectionId[] = [],
): LinkedExpansion {
  if (path.includes(section.id)) {
    throw new ScheduleInputError('linkCycle');
  }
  const group = index.groupsByPrimary.get(section.id);
  if (group === undefined) {
    return { sectionLists: [[section]], unavailable: [] };
  }
  const nextPath = [...path, section.id];
  const expansions = group.components.map((component) =>
    expandComponent({ primary: section, component, index, path: nextPath }),
  );
  const unavailable = expansions.flatMap((expansion) => expansion.unavailable);
  // SAFETY: a section is taken with every required component or not at all, so one component
  // with no permitted section leaves no list, never a list that leaves it out (planning/08
  // §Constraint formulation: required linked sections; ADR-0010 §5).
  if (expansions.some((expansion) => expansion.sectionLists.length === 0)) {
    return { sectionLists: [], unavailable };
  }
  const sectionLists = expansions.reduce<readonly (readonly Section[])[]>(
    (lists, expansion) =>
      lists.flatMap((list) => expansion.sectionLists.map((option) => [...list, ...option])),
    [[section]],
  );
  return { sectionLists, unavailable };
}

/**
 * Expands one required component into the section lists that satisfy it.
 *
 * @param link - The primary section, its component, the lookups, and the expansion path.
 * @returns One list per way to take the component, or none with an issue when no permitted
 *   section is published.
 */
function expandComponent(link: {
  readonly primary: Section;
  readonly component: LinkedSectionComponent;
  readonly index: LinkIndex;
  readonly path: readonly SectionId[];
}): LinkedExpansion {
  const { primary, component, index, path } = link;
  // NOTE: sorted by ID so the lists and issues never depend on the published list's order.
  const permitted = [...component.permittedSectionIds].sort(compareText).flatMap((id) => {
    const linked = index.sectionsById.get(id);
    return linked === undefined ? [] : [linked];
  });
  // SAFETY: a required component with no published permitted section is missing data, so it
  // is UNKNOWN LINKED_SECTION_UNAVAILABLE, never satisfied (ADR-0010 §5 and §6).
  if (permitted.length === 0) {
    const issue = createScheduleIssue({
      reasonCode: ReasonCode.LinkedSectionUnavailable,
      primarySectionId: primary.id,
      componentName: component.name,
      courseId: component.courseId,
    });
    return { sectionLists: [], unavailable: [issue] };
  }
  const expansions = permitted.map((linked) => expandLinkedSections(linked, index, path));
  return {
    sectionLists: expansions.flatMap((expansion) => expansion.sectionLists),
    unavailable: expansions.flatMap((expansion) => expansion.unavailable),
  };
}
