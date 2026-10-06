/**
 * @file Builds synthetic schedule options in the #258 contract shape: scheduled sections,
 *   section bundles, and whole options with their academic and schedule checks. Every builder
 *   parses its result with the contract schema, so a fixture that breaks a contract rule fails
 *   where it is built, not in the test that uses it.
 * @module @caa/test-kit/builders/schedule-option
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { z } from 'zod';

import {
  ScheduledSectionSchema,
  type ScheduleOption,
  ScheduleOptionSchema,
  SectionBundleSchema,
} from '@caa/api-contract';
import { AggregateState, CheckKind, CheckState, type Section } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { buildSection } from './section.builder';

/** One section of an option, in the contract shape. */
export type ScheduledSection = z.infer<typeof ScheduledSectionSchema>;

/** One course's bundle of an option, in the contract shape. */
export type SectionBundle = z.infer<typeof SectionBundleSchema>;

/** Raw input accepted for one option, as the contract schema reads it. */
export type ScheduleOptionInput = z.input<typeof ScheduleOptionSchema>;

/** The ruleset every synthetic credit load is computed under. */
const RULESET_VERSION = 'demo-2026.1';

/** Term credit bounds of the synthetic credit load: 1.00 to 18.00. */
const CREDIT_BOUNDS = { minCreditsHundredths: 100, maxCreditsHundredths: 1800 } as const;

/**
 * Projects a domain section into the contract's scheduled-section shape.
 *
 * @param section - The section, for example from `buildSection`.
 * @param countsCredits - `false` for a linked section whose credits its lecture includes.
 * @returns The scheduled section.
 */
export function buildScheduledSection(section: Section, countsCredits = true): ScheduledSection {
  return ScheduledSectionSchema.parse({
    sectionId: section.id,
    courseId: section.courseId,
    sectionCode: section.sectionCode,
    modality: section.modality,
    campusId: section.campusId,
    startsOn: section.startsOn,
    endsOn: section.endsOn,
    meetings: section.meetings,
    countsCredits,
  });
}

/**
 * Builds one course's bundle: its primary section first, then its required linked sections.
 *
 * @param sections - The primary section, then the linked ones. A domain `Section`
 *   counts its credits; a `ScheduledSection` keeps its own `countsCredits` flag.
 * @param creditsCountedHundredths - The bundle's counted credits, or `null` when undecided.
 * @returns The bundle, for the primary section's course.
 * @throws {Error} When no section is given.
 */
export function buildSectionBundle(
  sections: readonly (Section | ScheduledSection)[],
  creditsCountedHundredths: number | null,
): SectionBundle {
  const scheduled = sections.map((section) =>
    'sectionId' in section ? section : buildScheduledSection(section),
  );
  const [primary] = scheduled;
  if (primary === undefined) {
    throw new Error('A bundle needs its primary section');
  }
  return SectionBundleSchema.parse({
    courseId: primary.courseId,
    sections: scheduled,
    creditsCountedHundredths,
  });
}

/** The default option's only bundle: DEMO-MATH 102 section seed 1, MWF 09:00–09:50, 3.00. */
const DEFAULT_BUNDLE_SECTION = buildSection({ courseId: SYNTHETIC_COURSES.math102.id }, 1);

/**
 * Builds a PASS credit-load check whose total is the bundles' counted credits.
 *
 * @param bundles - The option's bundles.
 * @returns The check input.
 */
function passingLoad(
  bundles: readonly SectionBundle[],
): ScheduleOptionInput['setResults']['creditLoad'] {
  const total = bundles.reduce((sum, bundle) => sum + (bundle.creditsCountedHundredths ?? 0), 0);
  return {
    kind: CheckKind.CreditLoad,
    state: CheckState.Pass,
    evidence: {
      rulesetVersion: RULESET_VERSION,
      decisiveLeaves: [],
      creditLoad: { totalCreditsHundredths: total, ...CREDIT_BOUNDS },
    },
  };
}

/**
 * Builds a valid schedule option. By default it is rank 1 with one PASS bundle (DEMO-MATH 102,
 * 3.00 credits), no prerequisite rule, no linked-course result, PASS applicability and
 * allocation, a PASS credit load of the bundles' credits, no unmet preference, and a `VALIDATED`
 * aggregate.
 *
 * Course results follow the bundles unless given, and so does the credit load. Change a check's
 * state and the aggregate together: the contract rejects an aggregate that doesn't follow the
 * FAIL, UNKNOWN, CONDITIONAL, PASS precedence, and the builder never derives it for you.
 *
 * @param overrides - Fields to change.
 * @returns The option, parsed by the contract.
 */
export function buildScheduleOption(overrides: Partial<ScheduleOptionInput> = {}): ScheduleOption {
  const bundles = overrides.bundles ?? [buildSectionBundle([DEFAULT_BUNDLE_SECTION], 300)];
  const parsedBundles = bundles.map((bundle) => SectionBundleSchema.parse(bundle));
  return ScheduleOptionSchema.parse({
    rank: 1,
    scheduleFeasibility: { kind: CheckKind.ScheduleFeasibility, state: CheckState.Pass },
    courseResults: parsedBundles.map((bundle) => ({
      courseId: bundle.courseId,
      prerequisite: null,
      applicability: { kind: CheckKind.RequirementApplicability, state: CheckState.Pass },
    })),
    linkedCourseResults: [],
    setResults: {
      allocation: [{ kind: CheckKind.RequirementAllocation, state: CheckState.Pass }],
      creditLoad: passingLoad(parsedBundles),
    },
    unmetPreferences: [],
    aggregate: AggregateState.Validated,
    ...overrides,
    bundles,
  });
}
