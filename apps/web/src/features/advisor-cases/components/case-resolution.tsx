/**
 * @file The advisor's resolution of a case: who reviewed it and when, what they concluded, and
 * their note, always labeled as advice and never as permission.
 * @module @caa/web/features/advisor-cases/components/case-resolution
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { CaseEventView } from '@caa/api-contract';
import { Role } from '@caa/domain';

import { Timestamp } from '@/shared/components/timestamp';
import { ADVICE_NOT_PERMISSION, describeResolution } from '@/shared/utils/case-wording';

/** Props for {@link CaseResolution}. */
export interface CaseResolutionProps {
  /** The `RESOLVE` event. */
  readonly event: CaseEventView;
}

/**
 * Renders the resolution. The advisor's note is shown as the API returned it, as text.
 *
 * @param props - The resolve event.
 * @returns The resolution section.
 */
export function CaseResolution({ event }: CaseResolutionProps): ReactElement {
  const who = event.actorRole === Role.Admin ? 'an administrator' : 'your advisor';
  return (
    <section aria-label="Advisor review">
      <p>
        Reviewed by {who} on <Timestamp iso={event.at} />. {ADVICE_NOT_PERMISSION}
      </p>
      {event.resolution === null ? null : <p>{describeResolution(event.resolution)}.</p>}
      {event.note === null ? null : (
        <>
          <h4>Note from {who}</h4>
          <p className="note-text">{event.note}</p>
        </>
      )}
    </section>
  );
}
