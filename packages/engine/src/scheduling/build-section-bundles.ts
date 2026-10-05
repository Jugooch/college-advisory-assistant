/**
 * @file Builds a course's permitted section bundles: a section with exactly one of each linked section it requires.
 * @module @caa/engine/scheduling/build-section-bundles
 * @requirement FR-06
 * @requirement FR-07
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusTransitionPolicy,
  type CheckResult,
  CheckState,
  type Course,
  type CourseId,
  type Section,
  type SectionSnapshot,
} from '@caa/domain';

import { expandLinkedSections, indexLinks, type LinkIndex } from './expand-linked-sections';
import { findMeetingIssues } from './find-meeting-conflicts';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import { coursesOfBundle } from './section-bundle-credits';
import { compareText, tieBreakKeyOf } from './tie-break-key';

/** The requested course, the pinned section data, and the catalog courses it links to. */
export interface SectionBundleInput {
  /** The course the student requested. */
  readonly course: Course;
  /** The term's sections and linked-section groups. */
  readonly snapshot: Pick<SectionSnapshot, 'sections' | 'linkedSectionGroups'>;
  /** Catalog courses of every linked section the course's sections can require. */
  readonly linkedCourses: readonly Course[];
  /** The tenant's campus transition table, or `null` when it has none. */
  readonly transitionPolicy: CampusTransitionPolicy | null;
}

/** A set of sections taken together for one course, and how its own meetings fit. */
export interface SectionBundle {
  readonly courseId: CourseId;
  /** The course's section first, then its linked sections in component order. */
  readonly sections: readonly Section[];
  /**
   * Each distinct course of the bundle, the requested course first. Whether each adds its
   * credits depends on the whole plan (`toBundleCourseSelections`).
   */
  readonly courses: readonly Course[];
  /** The bundle's sections checked against each other: PASS, FAIL or UNKNOWN. */
  readonly feasibility: CheckResult;
}

/** What building a course's bundles found. */
export interface SectionBundles {
  /** Bundles whose sections don't conflict with each other (PASS or UNKNOWN), in tie-break order. */
  readonly bundles: readonly SectionBundle[];
  /** Bundles removed because their own sections conflict (FAIL), in tie-break order. */
  readonly blocked: readonly SectionBundle[];
  /**
   * An UNKNOWN `LINKED_SECTION_UNAVAILABLE` check naming every required component with no
   * permitted section, or `null` when there is none.
   */
  readonly unavailable: CheckResult | null;
}

/**
 * Builds every permitted bundle of a course: one of its sections with exactly one permitted
 * section of each linked component, expanded again where a linked section requires its own.
 *
 * - The course's sections are its own sections, except those another of its sections requires
 *   as a linked component (for example its recitations).
 * - A component with no published permitted section leaves no bundle for that section and is
 *   reported in `unavailable`.
 * - A bundle whose sections conflict with each other is `blocked` with its FAIL evidence (AC06).
 * - Bundles are ordered by their section IDs sorted ascending (ADR-0010 §4 tie-break) and
 *   never repeat a set of sections, so shuffling the input gives a deep-equal result.
 *
 * @param input - The course, the section data, the linked courses, and the transition table.
 * @returns The permitted, blocked and unavailable results.
 * @throws {ScheduleInputError} When linked groups form a cycle (`linkCycle`), or a linked
 *   section's course isn't in `linkedCourses` (`courseMissing`).
 */
export function buildSectionBundles(input: SectionBundleInput): SectionBundles {
  const { course, snapshot, transitionPolicy } = input;
  const index = indexLinks(snapshot);
  const courseById = new Map(
    [course, ...input.linkedCourses].map((entry) => [entry.id, entry] as const),
  );
  const expansions = ownSectionsOf(course.id, snapshot, index).map((own) => ({
    own,
    ...expandLinkedSections(own, index),
  }));
  const sectionLists = uniqueBySections(
    expansions
      .flatMap(({ own, sectionLists: lists }) =>
        lists.map((sections) => canonicalSections(own, sections)),
      )
      .filter((sections) => hasOneSectionPerComponent(sections, index)),
  );
  const bundles = sectionLists.map((sections): SectionBundle => ({
    courseId: course.id,
    sections,
    courses: coursesOfBundle(sections, courseById),
    feasibility: checkBundleMeetings(sections, transitionPolicy),
  }));
  const unavailableIssues = expansions.flatMap((expansion) => expansion.unavailable);
  // SAFETY: a bundle whose own sections conflict can't be taken, so it is removed with its FAIL
  // evidence, while an UNKNOWN bundle stays an option that is never PASS (AC06; ADR-0010 §3).
  const isBlocked = (bundle: SectionBundle): boolean =>
    bundle.feasibility.state === CheckState.Fail;
  return {
    bundles: bundles.filter((bundle) => !isBlocked(bundle)),
    blocked: bundles.filter(isBlocked),
    unavailable:
      unavailableIssues.length === 0 ? null : toScheduleFeasibilityCheck(unavailableIssues),
  };
}

/**
 * Lists the sections a course's bundles start from, sorted by ID.
 *
 * @param courseId - The requested course.
 * @param snapshot - The section data.
 * @param index - The snapshot's lookups.
 * @returns The course's sections that no other of its sections requires as a component.
 */
function ownSectionsOf(
  courseId: CourseId,
  snapshot: Pick<SectionSnapshot, 'sections'>,
  index: LinkIndex,
): Section[] {
  const own = snapshot.sections.filter((section) => section.courseId === courseId);
  // SAFETY: a section the course's own section requires as a component, such as a recitation,
  // is taken with that section, never on its own as the whole course (planning/08 §Constraint
  // formulation: at most one permitted bundle per planned course).
  const components = new Set(
    own.flatMap((section) =>
      (index.groupsByPrimary.get(section.id)?.components ?? []).flatMap(
        (component) => component.permittedSectionIds,
      ),
    ),
  );
  return own
    .filter((section) => !components.has(section.id))
    .sort((first, second) => compareText(first.id, second.id));
}

/**
 * Puts a section list in its canonical order: the course's own section first, then every other
 * section once, sorted by ID by code unit, so the order never depends on input order.
 *
 * @param own - The course's own section the list was expanded from.
 * @param sections - The expanded list, which may name a section twice through nested groups.
 * @returns The canonical list.
 */
function canonicalSections(own: Section, sections: readonly Section[]): readonly Section[] {
  const linked = new Map(
    sections.filter((section) => section.id !== own.id).map((section) => [section.id, section]),
  );
  return [own, ...[...linked.values()].sort((first, second) => compareText(first.id, second.id))];
}

/**
 * Returns whether a section list takes exactly one section of every component that any of its
 * sections requires, across groups too.
 *
 * @param sections - The section list.
 * @param index - The snapshot's lookups.
 * @returns `false` when some component is satisfied by two different sections of the list.
 */
function hasOneSectionPerComponent(sections: readonly Section[], index: LinkIndex): boolean {
  const ids = new Set(sections.map((section) => section.id));
  // SAFETY: a student takes exactly one permitted section of each required component, so a list
  // that nested groups filled with two of them can't be registered for and is never a bundle
  // (planning/08 §Constraint formulation: required linked sections).
  return sections.every((section) =>
    (index.groupsByPrimary.get(section.id)?.components ?? []).every(
      (component) => component.permittedSectionIds.filter((id) => ids.has(id)).length === 1,
    ),
  );
}

/**
 * Orders section lists by the tie-break key and drops lists with the same sections.
 *
 * @param lists - Canonical section lists.
 * @returns Distinct lists, in tie-break key order (ADR-0010 §4).
 */
function uniqueBySections(lists: readonly (readonly Section[])[]): (readonly Section[])[] {
  // NOTE: lists with one key hold the same sections in canonical order, and the lists arrive in
  // own-section ID order, so which duplicate the map keeps never depends on input order.
  const byKey = new Map(
    lists.map((sections) => [tieBreakKeyOf(sections.map((section) => section.id)), sections]),
  );
  return [...byKey.entries()]
    .sort(([first], [second]) => compareText(first, second))
    .map(([, sections]) => sections);
}

/**
 * Checks every pair of a bundle's sections against each other.
 *
 * @param sections - The bundle's sections, each once.
 * @param transitionPolicy - The tenant's transition table, or `null`.
 * @returns One `SCHEDULE_FEASIBILITY` check over every pair.
 */
function checkBundleMeetings(
  sections: readonly Section[],
  transitionPolicy: CampusTransitionPolicy | null,
): CheckResult {
  const ordered = [...sections].sort((first, second) => compareText(first.id, second.id));
  const issues = ordered.flatMap((first, position) =>
    ordered
      .slice(position + 1)
      .flatMap((second) => findMeetingIssues({ first, second, transitionPolicy })),
  );
  return toScheduleFeasibilityCheck(issues);
}
