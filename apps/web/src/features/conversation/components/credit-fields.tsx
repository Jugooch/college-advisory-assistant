/**
 * @file The edit fields of a credit-range chip: the fewest and most credits.
 * @module @caa/web/features/conversation/components/credit-fields
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ChipFieldsProps } from '../utils/chip-draft';
import { TextField } from './text-field';

/**
 * Fields for a credit range.
 *
 * @param props - The id, draft, error link and change handler.
 * @returns The fields.
 */
export function CreditFields({ id, draft, errorId, onChange }: ChipFieldsProps): ReactElement {
  return (
    <>
      <TextField
        id={`${id}-min`}
        label="Fewest credits"
        hint="A number such as 12 or 12.5. Leave blank for no minimum."
        inputMode="decimal"
        value={draft.min}
        errorId={errorId}
        onChange={(min) => {
          onChange({ min });
        }}
      />
      <TextField
        id={`${id}-max`}
        label="Most credits"
        hint="A number such as 15 or 15.5. Leave blank for no maximum."
        inputMode="decimal"
        value={draft.max}
        errorId={errorId}
        onChange={(max) => {
          onChange({ max });
        }}
      />
    </>
  );
}
