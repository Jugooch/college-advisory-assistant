/**
 * @file Input and result types of the schedule solver, and its documented work cap.
 * @module @caa/engine/scheduling/schedule-solution
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type {
  AcademicPolicy,
  CampusTransitionPolicy,
  CheckResult,
  CourseId,
  PrerequisiteRule,
  ScheduleConstraint,
  ScheduleOutcome,
  UnmetPreference,
} from '@caa/domain';

import type { SectionBundle, SectionBundles } from './build-section-bundles';
import type { LinkedCourseResult } from './linked-course-results';

/**
 * Default work cap (ADR-0010 §1). The unit is one attempt to add one bundle to a partial
 * schedule, counted before the attempt's hard rules are checked, so rejected attempts count.
 * Building bundles and checking bundle pairs and single sections happen once before the search
 * and aren't counted. An exhaustive search of the worst S4 input, 8 courses of 6 bundles each,
 * takes 6 + 6² + … + 6⁸ = 2,015,538 attempts, so this default finishes it with room to spare.
 * It is an engineering calibration, not institutional policy, and it is also the largest cap
 * accepted.
 */
export const DEFAULT_SOLVER_WORK_CAP = 3_000_000;

/** Fewest and most courses one request may name (ADR-0010 §2). */
export const MAX_SOLVER_COURSES = 8;

/** Most options the solver returns (ADR-0010 §4). */
export const MAX_SOLVER_OPTIONS = 3;

/** Most items in a conflict set before the rest are counted as omitted (ADR-0010 §5). */
export const MAX_CONFLICT_ITEMS = 20;

/** One requested course and the bundles built for it (`buildSectionBundles`). */
export interface ScheduleCourseRequest {
  readonly courseId: CourseId;
  readonly bundles: SectionBundles;
}

/** Everything the solver reads: the pinned inputs and the work cap. */
export interface SolveScheduleInput {
  /** The requested courses, 1 to 8, each named once; all are required. */
  readonly requests: readonly ScheduleCourseRequest[];
  /** The chosen credit value per variable-credit course; a course with no entry has none. */
  readonly selectedCredits: ReadonlyMap<CourseId, number>;
  /** The academic policy that supplies the term credit bounds. */
  readonly policy: AcademicPolicy;
  /** The request's constraints, in the student's order; issues refer to them by index. */
  readonly constraints: readonly ScheduleConstraint[];
  /** The tenant's campus transition table, or `null` when it has none. */
  readonly transitionPolicy: CampusTransitionPolicy | null;
  /**
   * Every prerequisite rule of the pinned ruleset for a course of the bundles, linked courses
   * included; only `courseId` is read, to find the linked courses with a rule of their own.
   */
  readonly prerequisiteRules: readonly Pick<PrerequisiteRule, 'courseId'>[];
  /** Most attempts the search may make, a whole number from 1 to the default. */
  readonly workCap: number;
}

/** One chosen bundle and the credits it adds to the option's load. */
export interface SolvedBundle {
  readonly bundle: SectionBundle;
  /** Credits counted in hundredths, or `null` when a variable credit value isn't chosen. */
  readonly creditsCountedHundredths: number | null;
}

/** One schedule option: a bundle per requested course that keeps every hard rule. */
export interface SolvedScheduleOption {
  /** 1 for the best option. */
  readonly rank: number;
  /** One bundle per requested course, by course ID. */
  readonly bundles: readonly SolvedBundle[];
  /** PASS, or UNKNOWN naming the missing data; never FAIL. */
  readonly scheduleFeasibility: CheckResult;
  /** The credit load against the policy and the student's hard range: PASS or UNKNOWN. */
  readonly creditLoad: CheckResult;
  /** Every place the option misses a preference, by priority rank. */
  readonly unmetPreferences: readonly UnmetPreference[];
  /**
   * One UNKNOWN result per linked course the requested courses' checks don't cover, ascending
   * by course ID without repeats; empty when there is none (ADR-0010 Amendment 4).
   */
  readonly linkedCourseResults: readonly LinkedCourseResult[];
}

/** Verified conflicts that explain `NO_FEASIBLE_PLAN`; never claimed to be minimal. */
export interface SolverConflictSet {
  readonly items: readonly CheckResult[];
  readonly isMinimal: false;
  readonly omittedCount: number;
}

/** The solver's answer (ADR-0010 §5). */
export interface ScheduleSolution {
  readonly outcome: ScheduleOutcome;
  /** `false` when the cap stopped the search, or the search didn't run. */
  readonly searchComplete: boolean;
  /** Up to three options, best first; empty unless the outcome is `OPTIONS_FOUND`. */
  readonly options: readonly SolvedScheduleOption[];
  /** The conflicts for `NO_FEASIBLE_PLAN`; `null` otherwise. */
  readonly conflictSet: SolverConflictSet | null;
  /** UNKNOWN results for `NEEDS_VERIFICATION`, by course ID; empty otherwise. */
  readonly unresolved: readonly CheckResult[];
  /** The cap the search ran with. */
  readonly workCap: number;
  /** Attempts the search made; never more than the cap. */
  readonly workUsed: number;
}
