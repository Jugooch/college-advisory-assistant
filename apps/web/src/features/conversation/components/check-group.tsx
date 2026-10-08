/**
 * @file A checkbox group for a chip edit: each value named in words, with the group's error
 * linked to it.
 * @module @caa/web/features/conversation/components/check-group
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/** Props for {@link CheckGroup}. */
export interface CheckGroupProps {
  readonly legend: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly chosen: readonly string[];
  /** The id of the error message that applies to this group, or `null`. */
  readonly errorId: string | null;
  readonly onChange: (chosen: readonly string[]) => void;
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
 * Checkbox group of values, each named in words.
 *
 * @param props - The legend, options, chosen values, error link and change handler.
 * @returns The fieldset.
 */
export function CheckGroup(props: CheckGroupProps): ReactElement {
  return (
    <fieldset aria-describedby={props.errorId ?? undefined}>
      <legend>{props.legend}</legend>
      {props.options.map(({ value, label }, index) => (
        <label key={value}>
          <input
            type="checkbox"
            aria-invalid={index === 0 && props.errorId !== null ? true : undefined}
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
