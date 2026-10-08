/**
 * @file The save-as-draft control for one schedule option, or for a result that has no options.
 * It builds the request from the search the student confirmed and the response's pinned inputs.
 * @module @caa/web/features/plan-drafts/components/option-draft-control
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type {
  ScheduleOption,
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
} from '@caa/api-contract';

import { optionSectionIds } from '@/shared/utils/option-section-ids';

import type { SaveDraftState } from '../utils/save-draft-state';
import { SaveDraftForm } from './save-draft-form';

/** Props for {@link OptionDraftControl}. */
export interface OptionDraftControlProps {
  /** Server action that saves the draft; the page passes it in (standard 06). */
  readonly saveAction: (previous: SaveDraftState, formData: FormData) => Promise<SaveDraftState>;
  readonly studentId: string;
  /** The request the options were computed from, unchanged. */
  readonly request: ScheduleOptionsRequest;
  /** The response the student is looking at; its pinned inputs are sent back unchanged. */
  readonly result: ScheduleOptionsResponse;
  /** The option to save, or `null` to save a result that has no options. */
  readonly option: ScheduleOption | null;
}

/**
 * Renders the save form for one option or for a result with no options.
 *
 * @param props - The action, the student, the search, the response, and the option.
 * @returns The save form.
 */
export function OptionDraftControl({
  saveAction,
  studentId,
  request,
  result,
  option,
}: OptionDraftControlProps): ReactElement {
  return (
    <SaveDraftForm
      saveAction={saveAction}
      studentId={studentId}
      draft={{
        request,
        selectedSectionIds: option === null ? null : optionSectionIds(option),
        expectedPinnedInputs: result.pinnedInputs,
      }}
      label={option === null ? 'Save this result' : 'Save as draft'}
      idPrefix={option === null ? 'save-result' : `save-option-${String(option.rank)}`}
      plansHref={`/my-plans?studentId=${studentId}`}
    />
  );
}

/**
 * Binds the search and the response, so a results view can ask for one option's control.
 *
 * @param base - The props every option shares.
 * @returns A function from an option, or `null` for a result with no options, to its control.
 */
export function bindOptionDraftControl(
  base: Omit<OptionDraftControlProps, 'option'>,
): (option: ScheduleOption | null) => ReactElement {
  return (option) => <OptionDraftControl {...base} option={option} />;
}
