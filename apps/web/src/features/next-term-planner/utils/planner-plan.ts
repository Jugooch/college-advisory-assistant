/**
 * @file Turns the typed planner values into a schedule-options request, or the issues that stop
 * it. The domain schemas decide validity: a contradiction is reported to the student and never
 * adjusted.
 * @module @caa/web/features/next-term-planner/utils/planner-plan
 * @requirement FR-08
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { MAX_SCHEDULE_OPTION_COURSES, type ScheduleOptionsRequest } from '@caa/api-contract';
import {
  CourseIdSchema,
  type ScheduleConstraint,
  ScheduleConstraintSchema,
  ScheduleConstraintSetSchema,
  TermIdSchema,
} from '@caa/domain';

import type { CourseLookup } from '@/shared/utils/course-display';
import { planCreditSelections } from '@/shared/utils/credit-selections';

import { type FieldError, readConstraintSlots } from './constraint-slots';
import { type ConstraintSlot, type PlannerFormValues, slotFieldName } from './planner-fields';

/** One thing that stops the search, for the error summary and, when it has one, its field. */
export interface PlannerIssue {
  /** The field's query name, or null for an issue about the whole set. */
  readonly name: string | null;
  readonly message: string;
}

/** What the typed values amount to. */
export interface PlannerPlan {
  /** The request, or null while any issue remains. */
  readonly request: ScheduleOptionsRequest | null;
  /** The constraints the student stated, parsed, in form order. Empty while any issue remains. */
  readonly constraints: readonly ScheduleConstraint[];
  readonly issues: readonly PlannerIssue[];
  /** Why a typed credit value was rejected, by course ID. */
  readonly creditErrors: ReadonlyMap<string, string>;
}

/** Message when two preferences share a priority. */
const DUPLICATE_RANK_MESSAGE = 'Give each preference a different priority number.';

/** The part of a slot each constraint field belongs to. */
const PART_BY_KEY: Readonly<Record<string, string>> = {
  weekdays: 'day',
  startTime: 'start',
  endTime: 'end',
  priorityRank: 'rank',
  minCreditsHundredths: 'min',
  maxCreditsHundredths: 'max',
};

/** What to tell the student for each part a parsed constraint can reject. */
const MESSAGE_BY_PART: Readonly<Record<string, string>> = {
  day: 'Choose at least one day.',
  start: 'Enter a start time that is earlier than the end time.',
  end: 'Enter an end time that is later than the start time.',
  rank: 'Enter a priority from 1 to 99, where 1 matters most.',
  campus: 'Enter each campus ID once, separated by commas.',
  min: 'Enter a minimum, a maximum, or both. The minimum can’t be more than the maximum.',
  max: 'Enter a maximum that is not below the minimum.',
};

/**
 * Names the field a rejected part of a slot belongs to.
 *
 * @param slot - The slot.
 * @param key - The constraint field the domain schema rejected.
 * @returns The field's query name.
 */
function fieldFor(slot: ConstraintSlot, key: string | number | symbol | undefined): string {
  if (slot === 'campus' || slot === 'modality') {
    return slot;
  }
  return slotFieldName(slot, PART_BY_KEY[String(key)] ?? 'strength');
}

/**
 * Reads the stated slots into constraints and the issues of the slots that don't parse.
 *
 * @param values - The typed values.
 * @returns The constraints and the issues.
 */
function parseSlots(values: PlannerFormValues): {
  readonly constraints: readonly ScheduleConstraint[];
  readonly issues: readonly PlannerIssue[];
} {
  const constraints: ScheduleConstraint[] = [];
  const issues: PlannerIssue[] = [];
  const addAll = (errors: readonly FieldError[]): void => {
    issues.push(...errors.map(([name, message]) => ({ name, message })));
  };
  for (const [slot, reading] of readConstraintSlots(values)) {
    if (reading.kind === 'invalid') {
      addAll(reading.errors);
    } else if (reading.kind === 'stated') {
      const parsed = ScheduleConstraintSchema.safeParse(reading.payload);
      if (parsed.success) {
        constraints.push(parsed.data);
      } else {
        const name = fieldFor(slot, parsed.error.issues[0]?.path[0]);
        const part =
          name === 'campus' || name === 'modality' ? name : name.slice(name.lastIndexOf('-') + 1);
        issues.push({ name, message: MESSAGE_BY_PART[part] ?? 'Check this constraint.' });
      }
    }
  }
  return { constraints, issues };
}

/**
 * Checks the term and the courses.
 *
 * @param values - The typed values.
 * @returns The issues; empty when both are valid.
 */
function checkTermAndCourses(values: PlannerFormValues): readonly PlannerIssue[] {
  const issues: PlannerIssue[] = [];
  if (!TermIdSchema.safeParse(values.termId).success) {
    issues.push({ name: 'term', message: 'Choose the term you are planning for.' });
  }
  const { courseIds } = values;
  if (courseIds.length === 0) {
    issues.push({ name: 'course', message: 'Choose at least one course.' });
  } else if (courseIds.length > MAX_SCHEDULE_OPTION_COURSES) {
    issues.push({
      name: 'course',
      message: `Choose at most ${String(MAX_SCHEDULE_OPTION_COURSES)} courses. You chose ${String(courseIds.length)}.`,
    });
  } else if (!courseIds.every((courseId) => CourseIdSchema.safeParse(courseId).success)) {
    issues.push({ name: 'course', message: 'Choose courses from the list.' });
  }
  return issues;
}

/**
 * Says why the constraints together are rejected, in the student's terms.
 *
 * @param message - The domain schema's message.
 * @returns The message for the error summary.
 */
function describeSetIssue(message: string): string {
  return message.includes('priorityRank')
    ? DUPLICATE_RANK_MESSAGE
    : `Your constraints contradict each other. ${message}.`;
}

/**
 * Plans the request. Constraints are parsed one by one for their own errors, then together, so a
 * contradiction between them is reported as such and never adjusted.
 *
 * @param values - The typed values.
 * @param courses - Catalog display entries, which carry each course's credit rule.
 * @returns The request, or the issues that stop it.
 */
export function planScheduleRequest(values: PlannerFormValues, courses: CourseLookup): PlannerPlan {
  const base = checkTermAndCourses(values);
  const courseIds = base.length === 0 ? CourseIdSchema.array().parse(values.courseIds) : [];
  const { selections, errors: creditErrors } = planCreditSelections(
    courseIds,
    values.creditInputs,
    courses,
  );
  const slots = parseSlots(values);
  const issues = [...base, ...slots.issues];
  for (const [courseId, message] of creditErrors) {
    issues.push({ name: `credits-${courseId}`, message });
  }
  const set = ScheduleConstraintSetSchema.safeParse(slots.constraints);
  if (!set.success && slots.issues.length === 0) {
    issues.push({ name: null, message: describeSetIssue(set.error.issues[0]?.message ?? '') });
  }
  if (issues.length > 0 || !set.success) {
    return { request: null, constraints: [], issues, creditErrors };
  }
  return {
    request: {
      termId: TermIdSchema.parse(values.termId),
      courseIds,
      creditSelections: selections,
      constraints: set.data,
    },
    constraints: set.data,
    issues,
    creditErrors,
  };
}
