/**
 * @file Factories for scheduling golden cases: complete solver inputs from the sections a case is
 *   about, the expected checks and options, and the case itself with its adjudication defaults.
 *   Every expected value is written by the adjudicator; these only fill in the format.
 * @module @caa/test-kit/golden/golden-schedule-factories
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/standards/07-testing.md
 */
import {
  type CampusTransition,
  CheckKind,
  CheckState,
  type LinkedSectionGroup,
  type MeetingPatternInput,
  type ReasonCode,
  type ScheduleConstraintSetInput,
  ScheduleOutcome,
  type Section,
  type SectionId,
  type SectionInput,
} from '@caa/domain';

import { buildAcademicPolicy } from '../builders/academic-policy.builder';
import { buildCampusTransitionPolicy } from '../builders/campus-transition-policy.builder';
import { buildMeetingPattern } from '../builders/meeting-pattern.builder';
import { buildSection } from '../builders/section.builder';
import { buildSectionSnapshot } from '../builders/section-snapshot.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { PENDING_ACADEMIC_REVIEW } from './golden-case.schema';
import {
  defineGoldenScheduleCase,
  GOLDEN_MAX_WORK_CAP,
  type GoldenScheduleCase,
  type GoldenScheduleCaseInput,
  type GoldenScheduleInputsInput,
} from './golden-schedule-case.schema';
import type { ExpectedScheduleInput } from './golden-schedule-expectation.schema';
import type { ExpectedScheduleIssue } from './golden-schedule-issue.schema';

/** Source versions behind every scheduling case. */
export const SCHEDULE_SOURCES: readonly string[] = [
  'section snapshot SYNTHETIC_SCHEDULE_TERM 2027SP',
  'catalog SYNTHETIC_COURSES v0',
  'ruleset demo-2026.1',
  'campus transitions demo-2026.1',
];

/** Reviewer and date of the S4 scheduling cases (#226). */
export const SCHEDULE_REVIEW = {
  reviewer: PENDING_ACADEMIC_REVIEW,
  adjudicatedOn: '2026-10-05',
} as const;

/** What a scheduling case states about its inputs; the rest takes the documented defaults. */
export interface ScheduleInputsAuthored {
  readonly requestedCourseIds: readonly string[];
  readonly sections: readonly Section[];
  /** None by default. */
  readonly linkedSectionGroups?: readonly LinkedSectionGroup[];
  /** The transition table's pairs, or `null` for no table at all; an empty table by default. */
  readonly transitions?: readonly CampusTransition[] | null;
  /** None by default. */
  readonly constraints?: ScheduleConstraintSetInput;
  /** Term credit bounds in hundredths; 1.00 to 18.00 by default. */
  readonly creditBounds?: {
    readonly minCreditsHundredths: number;
    readonly maxCreditsHundredths: number;
  };
  /** Chosen credits of variable-credit courses; none by default. */
  readonly creditSelections?: readonly {
    readonly courseId: string;
    readonly selectedCreditsHundredths: number;
  }[];
  /** The documented default, 3,000,000, unless the case is about the cap. */
  readonly workCap?: number;
}

/**
 * Builds complete solver inputs: the synthetic catalog, one tenant A snapshot of 2027SP with
 * the given sections, tenant A's transition table, and the ruleset's credit bounds.
 *
 * @param authored - What the case states.
 * @returns The inputs.
 */
export function scheduleInputs(authored: ScheduleInputsAuthored): GoldenScheduleInputsInput {
  const transitions = authored.transitions === undefined ? [] : authored.transitions;
  return {
    courses: Object.values(SYNTHETIC_COURSES),
    requestedCourseIds: authored.requestedCourseIds,
    creditSelections: authored.creditSelections ?? [],
    sectionSnapshot: buildSectionSnapshot({
      sections: authored.sections,
      linkedSectionGroups: authored.linkedSectionGroups ?? [],
    }),
    transitionPolicy: transitions === null ? null : buildCampusTransitionPolicy({ transitions }),
    constraints: authored.constraints ?? [],
    academicPolicy: buildAcademicPolicy({
      termCreditBounds: authored.creditBounds ?? {
        minCreditsHundredths: 100,
        maxCreditsHundredths: 1800,
      },
    }),
    workCap: authored.workCap ?? GOLDEN_MAX_WORK_CAP,
  };
}

/**
 * Lists sections' IDs ascending, the way an expected option or issue names them.
 *
 * @param sections - The sections, in any order.
 * @returns Their IDs, ascending by UTF-16 code unit.
 */
export function sectionIdsOf(...sections: readonly Section[]): readonly SectionId[] {
  return sections.map((section) => section.id).sort();
}

/** A schedule check with the issues that explain it, as a case writes it. */
export interface ScheduleCheckAuthored {
  readonly check: {
    readonly kind: CheckKind;
    readonly state: CheckState;
    readonly reasonCode: ReasonCode | null;
  };
  readonly issues: readonly ExpectedScheduleIssue[];
}

/** A PASS schedule check: no issue. */
export const SCHEDULE_PASS: ScheduleCheckAuthored = {
  check: { kind: CheckKind.ScheduleFeasibility, state: CheckState.Pass, reasonCode: null },
  issues: [],
};

/** What a case changes in a one-meeting section. */
export interface ScheduleSectionChanges {
  /** Changes to the meeting, MWF 09:00–09:50 on the north campus by default. */
  readonly meeting?: Partial<MeetingPatternInput>;
  /**
   * Changes to the section, whole-term on the north campus by default. Its `startsOn` and
   * `endsOn` also bound the meeting unless the meeting changes say otherwise.
   */
  readonly section?: Partial<SectionInput>;
}

/**
 * Builds a section of a course with one meeting, for scheduling cases.
 *
 * @param courseId - The course.
 * @param seed - The section seed; section IDs ascend with it.
 * @param changes - What the case changes.
 * @returns The section.
 */
export function scheduleSection(
  courseId: string,
  seed: number,
  { meeting = {}, section = {} }: ScheduleSectionChanges = {},
): Section {
  const dates = {
    ...(section.startsOn === undefined ? {} : { startsOn: section.startsOn }),
    ...(section.endsOn === undefined ? {} : { endsOn: section.endsOn }),
  };
  return buildSection(
    { courseId, ...section, meetings: [buildMeetingPattern({ ...dates, ...meeting })] },
    seed,
  );
}

/**
 * Expects a complete search with exactly one option.
 *
 * @param sectionIds - The option's sections, ascending.
 * @param scheduleFeasibility - Its schedule check; PASS by default.
 * @returns The expectation.
 */
export function expectOneOption(
  sectionIds: readonly SectionId[],
  scheduleFeasibility: ScheduleCheckAuthored = SCHEDULE_PASS,
): ExpectedScheduleInput {
  return {
    outcome: ScheduleOutcome.OptionsFound,
    searchComplete: true,
    options: [{ sectionIds, scheduleFeasibility }],
    conflictSet: null,
    unresolved: [],
  };
}

/**
 * Expects a complete search that proves no plan, with the given verified conflicts.
 *
 * @param items - The conflict-set items, in conflict-set order.
 * @returns The expectation, with nothing omitted.
 */
export function expectNoPlan(
  items: readonly [ScheduleCheckAuthored, ...ScheduleCheckAuthored[]],
): ExpectedScheduleInput {
  return {
    outcome: ScheduleOutcome.NoFeasiblePlan,
    searchComplete: true,
    options: [],
    conflictSet: { items, omittedCount: 0 },
    unresolved: [],
  };
}

/**
 * Builds a non-PASS schedule check whose reason is its first, decisive issue.
 *
 * @param state - FAIL or UNKNOWN.
 * @param issues - The issues, decisive first.
 * @returns The check and its issues.
 */
export function scheduleCheck(
  state: CheckState,
  issues: readonly [ExpectedScheduleIssue, ...ExpectedScheduleIssue[]],
): ScheduleCheckAuthored {
  return {
    check: { kind: CheckKind.ScheduleFeasibility, state, reasonCode: issues[0].reasonCode },
    issues,
  };
}

/** A scheduling case as written: the format's defaults may be left out. */
type AuthoredScheduleCase = Omit<
  GoldenScheduleCaseInput,
  'sourceVersions' | 'reviewer' | 'adjudicatedOn' | 'allowedAlternatives'
> &
  Partial<Pick<GoldenScheduleCaseInput, 'allowedAlternatives' | 'sourceVersions'>>;

/**
 * Validates a scheduling case written with the S4 adjudication defaults.
 *
 * @param authored - The case.
 * @returns The validated case.
 */
export function scheduleCase(authored: AuthoredScheduleCase): GoldenScheduleCase {
  return defineGoldenScheduleCase({
    allowedAlternatives: [],
    sourceVersions: [...SCHEDULE_SOURCES],
    ...SCHEDULE_REVIEW,
    ...authored,
  });
}
