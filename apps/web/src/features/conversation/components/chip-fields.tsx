/**
 * @file The labelled edit fields of a constraint chip, one component per constraint kind.
 * @module @caa/web/features/conversation/components/chip-fields
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { SectionModality, Weekday } from '@caa/domain';

import { describeModality, describeWeekday } from '@/shared/utils/section-wording';

import type { ChipDraft } from '../utils/chip-draft';

/** Props shared by the field groups. */
export interface FieldsProps {
  readonly id: string;
  readonly draft: ChipDraft;
  readonly onChange: (change: Partial<ChipDraft>) => void;
}

/**
 * Toggles one value in a list.
 *
 * @param list - The current values.
 * @param value - The value to add or remove.
 * @returns The new list.
 */
function toggle(list: readonly string[], value: string): readonly string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * A labelled single-line text field.
 *
 * @param props - The id, label, value and change handler.
 * @returns The label and input.
 */
export function TextField(props: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly inputMode?: 'numeric' | 'decimal';
  readonly onChange: (value: string) => void;
}): ReactElement {
  return (
    <>
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="text"
        inputMode={props.inputMode}
        autoComplete="off"
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </>
  );
}

/**
 * Checkbox group of values, each named in words.
 *
 * @param props - The legend, options, chosen values and change handler.
 * @returns The fieldset.
 */
function CheckGroup(props: {
  readonly legend: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly chosen: readonly string[];
  readonly onChange: (chosen: readonly string[]) => void;
}): ReactElement {
  return (
    <fieldset>
      <legend>{props.legend}</legend>
      {props.options.map(({ value, label }) => (
        <label key={value}>
          <input
            type="checkbox"
            checked={props.chosen.includes(value)}
            onChange={() => {
              props.onChange(toggle(props.chosen, value));
            }}
          />{' '}
          {label}{' '}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Fields for an unavailable time.
 *
 * @param props - The id, draft and change handler.
 * @returns The fields.
 */
export function TimeFields({ id, draft, onChange }: FieldsProps): ReactElement {
  const days = Object.values(Weekday).map((day) => ({ value: day, label: describeWeekday(day) }));
  return (
    <>
      <CheckGroup
        legend="Days"
        options={days}
        chosen={draft.days}
        onChange={(chosen) => {
          onChange({ days: chosen });
        }}
      />
      <TextField
        id={`${id}-start`}
        label="From (24-hour, HH:MM)"
        value={draft.start}
        onChange={(start) => {
          onChange({ start });
        }}
      />
      <TextField
        id={`${id}-end`}
        label="Until (24-hour, HH:MM)"
        value={draft.end}
        onChange={(end) => {
          onChange({ end });
        }}
      />
    </>
  );
}

/**
 * Fields for a credit range.
 *
 * @param props - The id, draft and change handler.
 * @returns The fields.
 */
export function CreditFields({ id, draft, onChange }: FieldsProps): ReactElement {
  return (
    <>
      <TextField
        id={`${id}-min`}
        label="Fewest credits (blank for none)"
        inputMode="decimal"
        value={draft.min}
        onChange={(min) => {
          onChange({ min });
        }}
      />
      <TextField
        id={`${id}-max`}
        label="Most credits (blank for none)"
        inputMode="decimal"
        value={draft.max}
        onChange={(max) => {
          onChange({ max });
        }}
      />
    </>
  );
}

/**
 * Fields for the allowed formats.
 *
 * @param props - The id, draft and change handler.
 * @returns The fields.
 */
export function ModalityFields({ draft, onChange }: FieldsProps): ReactElement {
  const options = Object.values(SectionModality).map((value) => ({
    value,
    label: describeModality(value),
  }));
  return (
    <CheckGroup
      legend="Allowed formats"
      options={options}
      chosen={draft.modalities}
      onChange={(modalities) => {
        onChange({ modalities });
      }}
    />
  );
}

/**
 * Field for the allowed campuses.
 *
 * @param props - The id, draft and change handler.
 * @returns The field.
 */
export function CampusFields({ id, draft, onChange }: FieldsProps): ReactElement {
  return (
    <TextField
      id={`${id}-campuses`}
      label="Campuses, separated by commas"
      value={draft.campuses}
      onChange={(campuses) => {
        onChange({ campuses });
      }}
    />
  );
}
