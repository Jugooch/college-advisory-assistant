/**
 * @file The credit range, class format, and campus constraints of the planner form, each with
 * its strength.
 * @module @caa/web/features/next-term-planner/components/limits-fieldsets
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { SectionModality } from '@caa/domain';

import { plannerFieldId, type PlannerFormValues, slotFieldName } from '../utils/planner-fields';
import { StrengthField } from './strength-field';

/** Props shared by the fieldsets. */
export interface LimitsProps {
  readonly values: PlannerFormValues;
  /** Field errors by query name. */
  readonly errors: ReadonlyMap<string, string>;
}

/**
 * Renders one labelled text field with its hint and error linked.
 *
 * @param props - The field's name, label, hint, value, and error.
 * @returns The field group.
 */
function TextField({
  name,
  label,
  hint,
  value,
  error,
}: {
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly error: string | undefined;
}): ReactElement {
  const id = plannerFieldId(name);
  const describedBy = error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        defaultValue={value}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
      />
      <p id={`${id}-hint`}>{hint}</p>
      {error === undefined ? null : (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Renders the credit range constraint.
 *
 * @param props - The typed values and the errors.
 * @returns The fieldset.
 */
export function CreditRangeFieldset({ values, errors }: LimitsProps): ReactElement {
  const { creditRange } = values;
  return (
    <fieldset>
      <legend>Credit range</legend>
      <TextField
        name={slotFieldName('credit-range', 'min')}
        label="Fewest credits"
        hint="Leave blank for no minimum, for example 12."
        value={creditRange.min}
        error={errors.get(slotFieldName('credit-range', 'min'))}
      />
      <TextField
        name={slotFieldName('credit-range', 'max')}
        label="Most credits"
        hint="Leave blank for no maximum, for example 15."
        value={creditRange.max}
        error={errors.get(slotFieldName('credit-range', 'max'))}
      />
      <StrengthField
        slot="credit-range"
        label="the credit range"
        input={creditRange}
        rankError={errors.get(slotFieldName('credit-range', 'rank')) ?? null}
      />
    </fieldset>
  );
}

/**
 * Renders the class format constraint.
 *
 * @param props - The typed values and the errors.
 * @returns The fieldset.
 */
export function ModalityFieldset({ values, errors }: LimitsProps): ReactElement {
  const { modality } = values;
  return (
    <fieldset>
      <legend>Class format</legend>
      <p>Choose the formats you will accept. Choose none to accept any.</p>
      {Object.values(SectionModality).map((value) => (
        <div className="choice" key={value}>
          <input
            id={`${plannerFieldId('modality')}-${value}`}
            type="checkbox"
            name="modality"
            value={value}
            defaultChecked={modality.values.includes(value)}
          />
          <label htmlFor={`${plannerFieldId('modality')}-${value}`}>
            {value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')}
          </label>
        </div>
      ))}
      <StrengthField
        slot="modality"
        label="the class format"
        input={modality}
        rankError={errors.get(slotFieldName('modality', 'rank')) ?? null}
      />
    </fieldset>
  );
}

/**
 * Renders the campus constraint.
 *
 * @param props - The typed values and the errors.
 * @returns The fieldset.
 */
export function CampusFieldset({ values, errors }: LimitsProps): ReactElement {
  return (
    <fieldset>
      <legend>Campus</legend>
      <TextField
        name="campus"
        label="Campus IDs you will accept"
        hint="Separate IDs with commas. Leave blank to accept any campus."
        value={values.campus.text}
        error={errors.get('campus')}
      />
      <StrengthField
        slot="campus"
        label="the campus"
        input={values.campus}
        rankError={errors.get(slotFieldName('campus', 'rank')) ?? null}
      />
    </fieldset>
  );
}
