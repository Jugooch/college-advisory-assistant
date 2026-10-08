/**
 * @file One unavailable-time block: weekdays, an optional time range, and its strength. Blank
 * times mean the whole day, so "no Fridays" is Friday alone.
 * @module @caa/web/features/next-term-planner/components/time-block-fieldset
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { Weekday } from '@caa/domain';

import { type ConstraintSlot, slotFieldName } from '@/shared/utils/planner-query-names';

import { plannerFieldId, type TimeBlockInput } from '../utils/planner-fields';
import { StrengthField } from './strength-field';

/** Props for {@link TimeBlockFieldset}. */
export interface TimeBlockFieldsetProps {
  readonly slot: ConstraintSlot;
  /** The block's number in the form, from 1. */
  readonly number: number;
  readonly block: TimeBlockInput;
  /** Field errors by query name. */
  readonly errors: ReadonlyMap<string, string>;
}

/**
 * Renders one text field of a block with its error linked.
 *
 * @param props - The field's name, label, value, and error.
 * @returns The labelled time field.
 */
function TimeField({
  name,
  label,
  value,
  error,
}: {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
}): ReactElement {
  const id = plannerFieldId(name);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="time"
        defaultValue={value}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
      />
      {error === undefined ? null : (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Renders the block's days, times, and strength.
 *
 * @param props - The slot, its number, the typed block, and the errors.
 * @returns The fieldset.
 */
export function TimeBlockFieldset({
  slot,
  number,
  block,
  errors,
}: TimeBlockFieldsetProps): ReactElement {
  const dayName = slotFieldName(slot, 'day');
  const dayError = errors.get(dayName);
  const label = `unavailable time ${String(number)}`;
  return (
    <fieldset>
      <legend>Unavailable time {number}</legend>
      <fieldset
        aria-describedby={dayError === undefined ? undefined : `${plannerFieldId(dayName)}-error`}
      >
        <legend>Days</legend>
        {Object.values(Weekday).map((day, index) => (
          <div className="choice" key={day}>
            <input
              id={index === 0 ? plannerFieldId(dayName) : `${plannerFieldId(dayName)}-${day}`}
              type="checkbox"
              name={dayName}
              value={day}
              defaultChecked={block.days.includes(day)}
            />
            <label
              htmlFor={index === 0 ? plannerFieldId(dayName) : `${plannerFieldId(dayName)}-${day}`}
            >
              {day.charAt(0) + day.slice(1).toLowerCase()}
            </label>
          </div>
        ))}
        {dayError === undefined ? null : (
          <p id={`${plannerFieldId(dayName)}-error`} className="field-error">
            {dayError}
          </p>
        )}
      </fieldset>
      <TimeField
        name={slotFieldName(slot, 'start')}
        label={`From (blank for the start of the day), ${label}`}
        value={block.start}
        error={errors.get(slotFieldName(slot, 'start'))}
      />
      <TimeField
        name={slotFieldName(slot, 'end')}
        label={`Until (blank for the end of the day), ${label}`}
        value={block.end}
        error={errors.get(slotFieldName(slot, 'end'))}
      />
      <StrengthField
        slot={slot}
        label={label}
        input={block}
        rankError={errors.get(slotFieldName(slot, 'rank')) ?? null}
      />
    </fieldset>
  );
}
