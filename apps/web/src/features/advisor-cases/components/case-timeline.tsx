/**
 * @file A case's history, oldest first. Actors are a role plus "You", never a name or an ID.
 * @module @caa/web/features/advisor-cases/components/case-timeline
 * @requirement FR-12
 * @requirement FR-14
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { CaseEventView } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';
import { describeAction, describeActor } from '@/shared/utils/case-wording';

/** Props for {@link CaseTimeline}. */
export interface CaseTimelineProps {
  readonly events: readonly CaseEventView[];
}

/**
 * Renders one line per event.
 *
 * @param props - The events as the API returned them.
 * @returns The history list.
 */
export function CaseTimeline({ events }: CaseTimelineProps): ReactElement {
  return (
    <ol>
      {events.map((event) => (
        <li key={event.id}>
          <Timestamp iso={event.at} />: {describeActor(event.actorRole, event.isYou)}{' '}
          {describeAction(event.action)}
        </li>
      ))}
    </ol>
  );
}
