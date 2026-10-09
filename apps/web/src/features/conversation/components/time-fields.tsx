/**
 * @file The edit fields of an unavailable-time chip: days and the start and end times.
 * @module @caa/web/features/conversation/components/time-fields
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { Weekday } from '@caa/domain';

import { describeWeekday } from '@/shared/utils/section-wording';

import { CheckGroup } from './check-group';
import type { ChipFieldsProps } from './chip-fields-props';
import { TextField } from './text-field';

/**
 * Fields for an unavailable time.
 *
 * @param props - The id, draft, error link and change handler.
 * @returns The fields.
 */
export function TimeFields({ id, draft, errorId, onChange }: ChipFieldsProps): ReactElement {
  const days = Object.values(Weekday).map((day) => ({ value: day, label: describeWeekday(day) }));
  return (
    <>
      <CheckGroup
        legend="Days"
        options={days}
        chosen={draft.days}
        errorId={errorId}
        onChange={(chosen) => {
          onChange({ days: chosen });
        }}
      />
      <TextField
        id={`${id}-start`}
        label="From"
        hint="24-hour time as HH:MM, for example 09:30. Leave blank for the start of the day."
        value={draft.start}
        errorId={errorId}
        onChange={(start) => {
          onChange({ start });
        }}
      />
      <TextField
        id={`${id}-end`}
        label="Until"
        hint="24-hour time as HH:MM, for example 17:00. Leave blank for the end of the day."
        value={draft.end}
        errorId={errorId}
        onChange={(end) => {
          onChange({ end });
        }}
      />
    </>
  );
}
