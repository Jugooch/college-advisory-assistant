/**
 * @file Reads the typed credit values of a submitted course form and turns them into credit
 * selections for a request, only for variable-credit courses and never with an assumed value.
 * @module @caa/web/shared/utils/credit-selections
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { type CourseId, CreditRuleKind } from '@caa/domain';

import type { CourseLookup } from './course-display';
import { CREDIT_FIELD_PREFIX, readCreditChoice } from './credit-choice';

/** One chosen credit value, in the shape both request contracts take. */
export interface CreditSelectionValue {
  readonly courseId: CourseId;
  /** Chosen credits in hundredths (350 = 3.5). */
  readonly selectedCreditsHundredths: number;
}

/** The credit selections of a submission, or why typed values were rejected. */
export interface CreditSelectionPlan {
  /** One entry per variable-credit course with a typed value, in course order. */
  readonly selections: readonly CreditSelectionValue[];
  /** Why a typed credit value was rejected, by course ID. */
  readonly errors: ReadonlyMap<string, string>;
}

/**
 * Reads the typed credit values. A repeated field is joined, so it fails parsing and is reported.
 *
 * @param query - The page's search params.
 * @returns The typed text by course ID.
 */
export function readCreditInputs(
  query: Readonly<Record<string, string | readonly string[] | undefined>>,
): ReadonlyMap<string, string> {
  const inputs = new Map<string, string>();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith(CREDIT_FIELD_PREFIX) && value !== undefined) {
      inputs.set(key.slice(CREDIT_FIELD_PREFIX.length), [value].flat().join(','));
    }
  }
  return inputs;
}

/**
 * Plans the credit selections. Only a course whose catalog rule is VARIABLE takes a value. A
 * blank value is left out, so the credit-load check reports it as unknown.
 *
 * @param courseIds - The chosen courses, in order.
 * @param inputs - Typed credit text by course ID.
 * @param courses - Catalog display entries, which carry each course's credit rule.
 * @returns The selections and any errors.
 */
export function planCreditSelections(
  courseIds: readonly CourseId[],
  inputs: ReadonlyMap<string, string>,
  courses: CourseLookup,
): CreditSelectionPlan {
  const selections: CreditSelectionValue[] = [];
  const errors = new Map<string, string>();
  for (const courseId of courseIds) {
    const rule = courses.get(courseId)?.credits;
    if (rule?.kind !== CreditRuleKind.Variable) {
      continue;
    }
    const choice = readCreditChoice(inputs.get(courseId), rule);
    if (choice.kind === 'invalid') {
      errors.set(courseId, choice.message);
    } else if (choice.kind === 'chosen') {
      selections.push({ courseId, selectedCreditsHundredths: choice.hundredths });
    }
  }
  return { selections, errors };
}
