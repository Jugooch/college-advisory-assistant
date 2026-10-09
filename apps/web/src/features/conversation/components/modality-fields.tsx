/**
 * @file The edit field of an allowed-formats chip.
 * @module @caa/web/features/conversation/components/modality-fields
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { SectionModality } from '@caa/domain';

import { describeModality } from '@/shared/utils/section-wording';

import { CheckGroup } from './check-group';
import type { ChipFieldsProps } from './chip-fields-props';

/**
 * Fields for the allowed formats.
 *
 * @param props - The draft, error link and change handler.
 * @returns The fields.
 */
export function ModalityFields({ draft, errorId, onChange }: ChipFieldsProps): ReactElement {
  const options = Object.values(SectionModality).map((value) => ({
    value,
    label: describeModality(value),
  }));
  return (
    <CheckGroup
      legend="Allowed formats"
      options={options}
      chosen={draft.modalities}
      errorId={errorId}
      onChange={(modalities) => {
        onChange({ modalities });
      }}
    />
  );
}
