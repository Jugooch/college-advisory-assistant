/**
 * @file Screens a course's bundles against the hard constraints and scores them on preferences.
 * @module @caa/engine/scheduling/screen-bundles
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CheckResult,
  CheckState,
  ConstraintStrength,
  createUnmetPreference,
  type ScheduleConstraint,
  type ScheduleConstraintKind,
  type ScheduleIssue,
  type Section,
  type UnmetPreference,
} from '@caa/domain';

import type { SectionBundle, SectionBundles } from './build-section-bundles';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import type { ConstraintFinding } from './section-constraint-findings';
import { tieBreakKeyOf } from './tie-break-key';

/** One preference, in the student's priority order. */
export interface PreferenceSlot {
  readonly constraintIndex: number;
  readonly priorityRank: number;
  readonly kind: ScheduleConstraintKind;
}

/** A FAIL result the solver produced, with what it is deduplicated and sorted by. */
export interface ConflictEntry {
  /** The FAIL's reason code, as text for ordering. */
  readonly reasonCode: string;
  /** The tie-break key of the sections the FAIL is about. */
  readonly key: string;
  readonly check: CheckResult;
}

/** A bundle that keeps every hard constraint, with what it alone contributes to an option. */
export interface ScreenedBundle {
  readonly bundle: SectionBundle;
  /** Whether missing data leaves it undecided. */
  readonly isUnknown: boolean;
  /** UNKNOWN issues of its own sections against each other and against hard constraints. */
  readonly unknownIssues: readonly ScheduleIssue[];
  /** Where it misses preferences, in priority order. */
  readonly unmet: readonly UnmetPreference[];
  /** 1 for each preference slot it misses, 0 otherwise. */
  readonly misses: readonly number[];
}

/** What screening one course's bundles found. */
export interface BundleScreen {
  /** Bundles that keep every hard constraint. */
  readonly kept: readonly ScreenedBundle[];
  /** FAIL results that removed bundles: own conflicts, and sections breaking a hard rule. */
  readonly conflicts: readonly ConflictEntry[];
}

/** The constraints and a per-section finding lookup shared by every course. */
export interface ScreenContext {
  /** Indexes of the request's `HARD` constraints. */
  readonly hardIndexes: ReadonlySet<number>;
  readonly slots: readonly PreferenceSlot[];
  readonly findingsOf: (section: Section) => readonly ConstraintFinding[];
}

/**
 * Lists the request's preferences in the student's priority order, rank 1 first.
 *
 * @param constraints - The request's constraints.
 * @returns One slot per preference.
 */
export function preferenceSlotsOf(constraints: readonly ScheduleConstraint[]): PreferenceSlot[] {
  return constraints
    .flatMap((constraint, constraintIndex) =>
      constraint.priorityRank === null
        ? []
        : [{ constraintIndex, priorityRank: constraint.priorityRank, kind: constraint.kind }],
    )
    .sort((first, second) => first.priorityRank - second.priorityRank);
}

/**
 * Screens a course's bundles: a bundle whose own sections conflict, or with a section that
 * breaks a hard constraint, is removed with its FAIL evidence; the rest are kept.
 *
 * @param bundles - The course's bundles.
 * @param context - The constraints and the finding lookup.
 * @returns The kept bundles and the FAIL results.
 */
export function screenBundles(bundles: SectionBundles, context: ScreenContext): BundleScreen {
  const conflicts: ConflictEntry[] = bundles.blocked.map((blocked) =>
    conflictOf(blocked.feasibility, blocked.sections),
  );
  const kept = bundles.bundles.flatMap((bundle): ScreenedBundle[] => {
    const failing = bundle.sections.flatMap((section) => {
      const hardFails = context
        .findingsOf(section)
        .filter((finding) => isHard(finding, context) && !finding.isUnknown);
      return hardFails.length === 0 ? [] : [{ section, hardFails }];
    });
    // SAFETY: a hard constraint is never relaxed, so a bundle with a section that breaks one is
    // removed with the FAIL as evidence (ADR-0010 §3).
    if (failing.length > 0) {
      conflicts.push(
        ...failing.map(({ section, hardFails }) =>
          conflictOf(toScheduleFeasibilityCheck(hardFails.map((finding) => finding.issue)), [
            section,
          ]),
        ),
      );
      return [];
    }
    return [screened(bundle, context)];
  });
  return { kept, conflicts };
}

/**
 * Describes a kept bundle: its UNKNOWN issues, unmet preferences and misses.
 *
 * @param bundle - A bundle that keeps every hard constraint.
 * @param context - The constraints and the finding lookup.
 * @returns The screened bundle.
 */
function screened(bundle: SectionBundle, context: ScreenContext): ScreenedBundle {
  const findings = bundle.sections.flatMap((section) => context.findingsOf(section));
  const ownUnknown = bundle.feasibility.evidence?.scheduleIssues ?? [];
  // SAFETY: missing data a hard constraint depends on leaves the bundle UNKNOWN, never PASS
  // (planning/08 §Schedule model; ADR-0010 §3).
  const unknownIssues = [
    ...ownUnknown,
    ...findings.filter((finding) => isHard(finding, context)).map((finding) => finding.issue),
  ];
  const unmet = context.slots.flatMap((slot) =>
    findings
      .filter((finding) => finding.constraintIndex === slot.constraintIndex)
      .map((finding) => toUnmet(finding, slot)),
  );
  return {
    bundle,
    isUnknown: bundle.feasibility.state === CheckState.Unknown || unknownIssues.length > 0,
    unknownIssues,
    unmet,
    misses: context.slots.map((slot) =>
      unmet.some((entry) => entry.constraintIndex === slot.constraintIndex) ? 1 : 0,
    ),
  };
}

/**
 * Builds the unmet preference for a finding.
 *
 * @param finding - Where the section misses the preference.
 * @param slot - The preference.
 * @returns The validated unmet preference.
 */
function toUnmet(finding: ConstraintFinding, slot: PreferenceSlot): UnmetPreference {
  // SAFETY: a preference that depends on data to be announced counts as not met, and says so,
  // so the UI shows "unknown" rather than "missed" (ADR-0010 §4).
  return createUnmetPreference({
    constraintIndex: slot.constraintIndex,
    priorityRank: slot.priorityRank,
    kind: slot.kind,
    sectionId: finding.sectionId,
    meetingIndex: finding.meetingIndex,
    isDataUnknown: finding.isUnknown,
  });
}

/**
 * Returns whether a finding is about a hard constraint.
 *
 * @param finding - The finding.
 * @param context - The hard constraint indexes.
 * @returns `true` for a `HARD` constraint.
 */
function isHard(finding: ConstraintFinding, context: ScreenContext): boolean {
  return context.hardIndexes.has(finding.constraintIndex);
}

/**
 * Lists the indexes of a request's hard constraints.
 *
 * @param constraints - The request's constraints.
 * @returns The indexes of its `HARD` items.
 */
export function hardIndexesOf(constraints: readonly ScheduleConstraint[]): ReadonlySet<number> {
  return new Set(
    constraints.flatMap((constraint, index) =>
      constraint.strength === ConstraintStrength.Hard ? [index] : [],
    ),
  );
}

/**
 * Wraps a FAIL check as a conflict entry.
 *
 * @param check - The FAIL check.
 * @param sections - The sections it is about.
 * @returns The entry.
 */
function conflictOf(check: CheckResult, sections: readonly Section[]): ConflictEntry {
  return {
    reasonCode: String(check.reasonCode),
    key: tieBreakKeyOf(sections.map((section) => section.id)),
    check,
  };
}
