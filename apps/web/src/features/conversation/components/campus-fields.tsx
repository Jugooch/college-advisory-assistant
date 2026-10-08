/**
 * @file The edit field of an allowed-campuses chip.
 * @module @caa/web/features/conversation/components/campus-fields
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ChipFieldsProps } from '../utils/chip-draft';
import { TextField } from './text-field';

/**
 * Field for the allowed campuses.
 *
 * @param props - The id, draft, error link and change handler.
 * @returns The field.
 */
export function CampusFields({ id, draft, errorId, onChange }: ChipFieldsProps): ReactElement {
  return (
    <TextField
      id={`${id}-campuses`}
      label="Campuses"
      hint="Separate campuses with commas."
      value={draft.campuses}
      errorId={errorId}
      onChange={(campuses) => {
        onChange({ campuses });
      }}
    />
  );
}
