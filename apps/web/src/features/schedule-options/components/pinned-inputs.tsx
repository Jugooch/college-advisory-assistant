/**
 * @file The data a result was computed from, one interaction away.
 * @module @caa/web/features/schedule-options/components/pinned-inputs
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOptionsResponse } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

/** Props for {@link PinnedInputs}. */
export interface PinnedInputsProps {
  readonly pinned: ScheduleOptionsResponse['pinnedInputs'];
  readonly searchComplete: boolean;
}

/**
 * Renders what the result is based on.
 *
 * @param props - The pinned inputs and whether the search finished.
 * @returns A details element.
 */
export function PinnedInputs({ pinned, searchComplete }: PinnedInputsProps): ReactElement {
  return (
    <details>
      <summary>What these results are based on</summary>
      <dl className="facts">
        <div className="facts__row">
          <dt>Search finished</dt>
          <dd>{searchComplete ? 'Yes' : 'No'}</dd>
        </div>
        <div className="facts__row">
          <dt>Student record as of</dt>
          <dd>
            <Timestamp iso={pinned.studentRecordEffectiveAt} />
          </dd>
        </div>
        <div className="facts__row">
          <dt>Degree audit as of</dt>
          <dd>
            <Timestamp iso={pinned.auditRecordEffectiveAt} />
          </dd>
        </div>
        <div className="facts__row">
          <dt>Ruleset</dt>
          <dd>{pinned.rulesetVersion}</dd>
        </div>
        <div className="facts__row">
          <dt>Published sections snapshot</dt>
          <dd>
            <code>{pinned.sectionSnapshotId}</code>
          </dd>
        </div>
      </dl>
    </details>
  );
}
