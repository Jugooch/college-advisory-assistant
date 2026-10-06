/**
 * @file Carries every typed planner value in hidden fields, so the review and retry buttons keep
 * the confirmed constraints without a script or stored state.
 * @module @caa/web/features/next-term-planner/components/hidden-values
 * @requirement FR-08
 */
import type { ReactElement } from 'react';

import { creditFieldName } from '@/shared/utils/credit-choice';

import { type PlannerFormValues, slotFieldName, TIME_BLOCK_SLOTS } from '../utils/planner-fields';

/** One hidden field. */
type Entry = readonly [name: string, value: string];

/**
 * Lists the hidden fields of one constraint's strength and priority.
 *
 * @param slot - The slot's name prefix.
 * @param input - The typed strength and priority.
 * @returns The entries.
 */
function strengthEntries(
  slot: Parameters<typeof slotFieldName>[0],
  input: { readonly strength: string; readonly rank: string },
): readonly Entry[] {
  return [
    [slotFieldName(slot, 'strength'), input.strength],
    [slotFieldName(slot, 'rank'), input.rank],
  ];
}

/**
 * Lists every field of the typed values.
 *
 * @param values - The typed values.
 * @returns The entries, in form order.
 */
export function valueEntries(values: PlannerFormValues): readonly Entry[] {
  const blocks = TIME_BLOCK_SLOTS.flatMap((slot): readonly Entry[] => {
    const block = values.timeBlocks[slot];
    return [
      ...block.days.map((day): Entry => [slotFieldName(slot, 'day'), day]),
      [slotFieldName(slot, 'start'), block.start],
      [slotFieldName(slot, 'end'), block.end],
      ...strengthEntries(slot, block),
    ];
  });
  return [
    ['term', values.termId],
    ...values.courseIds.map((courseId): Entry => ['course', courseId]),
    ...[...values.creditInputs].map(([courseId, text]): Entry => [creditFieldName(courseId), text]),
    ...blocks,
    [slotFieldName('credit-range', 'min'), values.creditRange.min],
    [slotFieldName('credit-range', 'max'), values.creditRange.max],
    ...strengthEntries('credit-range', values.creditRange),
    ...values.modality.values.map((value): Entry => ['modality', value]),
    ...strengthEntries('modality', values.modality),
    ['campus', values.campus.text],
    ...strengthEntries('campus', values.campus),
  ];
}

/**
 * Renders the hidden fields.
 *
 * @param props - The typed values.
 * @returns The hidden inputs.
 */
export function HiddenValues({ values }: { readonly values: PlannerFormValues }): ReactElement {
  return (
    <>
      {valueEntries(values).map(([name, value], index) => (
        <input key={`${name}-${String(index)}`} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}
