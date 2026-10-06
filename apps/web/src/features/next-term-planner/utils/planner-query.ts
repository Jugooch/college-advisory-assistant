/**
 * @file Reads the planner page's query: the student, the step, and every typed value.
 * @module @caa/web/features/next-term-planner/utils/planner-query
 * @requirement FR-08
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { readCreditInputs } from '@/shared/utils/credit-selections';
import { readStudentIdQuery, type StudentIdQuery } from '@/shared/utils/student-id-query';

import {
  type ConstraintSlot,
  defaultRank,
  type PlannerFormValues,
  PlannerStep,
  slotFieldName,
  type StrengthInput,
  TIME_BLOCK_SLOTS,
  type TimeBlockInput,
} from './planner-fields';

/** Search params as Next passes them. */
export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The parsed query. */
export interface PlannerQuery {
  readonly student: StudentIdQuery;
  readonly step: PlannerStep;
  readonly values: PlannerFormValues;
}

/**
 * Reads one text field. A repeated field is joined, so it fails parsing and is reported.
 *
 * @param query - The page's search params.
 * @param name - The field name.
 * @returns The trimmed text, or an empty string when not sent.
 */
function readText(query: SearchParams, name: string): string {
  const value = query[name];
  return value === undefined ? '' : [value].flat().join(',').trim();
}

/**
 * Reads a repeatable field, such as a checkbox group, once per value.
 *
 * @param query - The page's search params.
 * @param name - The field name.
 * @returns The distinct values, in submitted order.
 */
function readList(query: SearchParams, name: string): readonly string[] {
  const value = query[name];
  return value === undefined ? [] : [...new Set([value].flat())];
}

/**
 * Reads a slot's strength and priority. A priority never sent gets the slot's default.
 *
 * @param query - The page's search params.
 * @param slot - The constraint slot.
 * @returns The typed strength and priority.
 */
function readStrength(query: SearchParams, slot: ConstraintSlot): StrengthInput {
  const rankName = slotFieldName(slot, 'rank');
  return {
    strength: readText(query, slotFieldName(slot, 'strength')),
    rank: query[rankName] === undefined ? defaultRank(slot) : readText(query, rankName),
  };
}

/**
 * Reads one unavailable-time block.
 *
 * @param query - The page's search params.
 * @param slot - The block's slot.
 * @returns The typed block.
 */
function readTimeBlock(
  query: SearchParams,
  slot: (typeof TIME_BLOCK_SLOTS)[number],
): TimeBlockInput {
  return {
    ...readStrength(query, slot),
    days: readList(query, slotFieldName(slot, 'day')),
    start: readText(query, slotFieldName(slot, 'start')),
    end: readText(query, slotFieldName(slot, 'end')),
  };
}

/**
 * Reads the step. Anything unknown shows the form, so no search starts by accident.
 *
 * @param value - The `step` param.
 * @returns The step.
 */
function readStep(value: SearchParams[string]): PlannerStep {
  return value === PlannerStep.Review || value === PlannerStep.Search ? value : PlannerStep.Edit;
}

/**
 * Reads the planner page's query. Values stay as typed; the request plan validates them.
 *
 * @param query - The page's search params.
 * @returns The student, the step, and the typed values.
 */
export function readPlannerQuery(query: SearchParams): PlannerQuery {
  const [block1, block2, block3] = TIME_BLOCK_SLOTS;
  return {
    student: readStudentIdQuery(query.studentId),
    step: readStep(query.step),
    values: {
      termId: readText(query, 'term'),
      courseIds: readList(query, 'course'),
      creditInputs: readCreditInputs(query),
      timeBlocks: {
        [block1]: readTimeBlock(query, block1),
        [block2]: readTimeBlock(query, block2),
        [block3]: readTimeBlock(query, block3),
      },
      creditRange: {
        ...readStrength(query, 'credit-range'),
        min: readText(query, slotFieldName('credit-range', 'min')),
        max: readText(query, slotFieldName('credit-range', 'max')),
      },
      modality: { ...readStrength(query, 'modality'), values: readList(query, 'modality') },
      campus: { ...readStrength(query, 'campus'), text: readText(query, 'campus') },
    },
  };
}
