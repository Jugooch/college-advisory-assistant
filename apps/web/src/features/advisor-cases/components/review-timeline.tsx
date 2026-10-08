/**
 * @file A case's history for the reviewer, oldest first. Actors are a role plus "You", never a
 * name or an ID. A resolution shows its code and the note the student can read.
 * @module @caa/web/features/advisor-cases/components/review-timeline
 * @requirement FR-12
 * @requirement FR-14
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { CaseEventView } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

import { describeAction } from '../utils/case-wording';
import { describeResolutionOption, describeReviewActor } from '../utils/review-wording';

/** Props for {@link ReviewTimeline}. */
export interface ReviewTimelineProps {
  readonly events: readonly CaseEventView[];
}

/**
 * Renders one item per event.
 *
 * @param props - The events as the API returned them.
 * @returns The history list.
 */
export function ReviewTimeline({ events }: ReviewTimelineProps): ReactElement {
  return (
    <ol>
      {events.map((event) => (
        <li key={event.id}>
          <Timestamp iso={event.at} />: {describeReviewActor(event.actorRole, event.isYou)}{' '}
          {describeAction(event.action)}
          {event.resolution === null
            ? null
            : `. Outcome: ${describeResolutionOption(event.resolution)}`}
          {event.note === null ? null : (
            <>
              . Note the student can read: <span className="note-text">{event.note}</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
