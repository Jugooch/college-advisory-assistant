/**
 * @file The checks that did not pass on a revision, listed for the "what will be shared" preview.
 * States are shown as the API returned them and never upgraded.
 * @module @caa/web/features/advisor-cases/components/shared-checks-list
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { StatusBadge } from '@/components/ui/status-badge';
import { CourseLabel } from '@/shared/components/course-label';
import { describeCheckState } from '@/shared/utils/check-state-wording';
import type { CourseLookup } from '@/shared/utils/course-display';
import { describeReason } from '@/shared/utils/reason-code-wording';

import { describeCheckKind, type SharedChecks } from '../utils/shared-checks';

/** Props for {@link SharedChecksList}. */
export interface SharedChecksListProps {
  readonly checks: SharedChecks;
  /** Catalog display entries by course ID. */
  readonly courses: CourseLookup;
}

/** Shown when the revision's checks can't be listed. */
export const CHECKS_UNAVAILABLE =
  'The saved result can’t be displayed right now, so its checks can’t be listed here. Your advisor will see the saved revision itself.';

/** Shown when every check passed, which is all the list can say. */
export const NO_FAILING_CHECKS =
  'No failing or unknown checks on this revision. Passed checks are not a registration or an approval.';

/** Shown when the search behind the revision did not finish. */
export const SEARCH_INCOMPLETE =
  'The search for this plan did not finish, so the result is undecided. Passed checks cannot be assumed.';

/**
 * Says how many conflicts the result left out.
 *
 * @param count - The omitted count from the result.
 * @returns A sentence.
 */
function omittedSentence(count: number): string {
  return `${String(count)} more ${count === 1 ? 'conflict is' : 'conflicts are'} not listed here.`;
}

/**
 * Renders the list, or the reason it can't be shown.
 *
 * @param props - The checks and the course display entries.
 * @returns The list or a message.
 */
export function SharedChecksList({ checks, courses }: SharedChecksListProps): ReactElement {
  if (checks.kind === 'unavailable') {
    return <p>{CHECKS_UNAVAILABLE}</p>;
  }
  const isIncomplete = checks.kind === 'incomplete';
  const omittedCount = checks.kind === 'listed' ? checks.omittedCount : 0;
  if (checks.checks.length === 0) {
    return <p>{isIncomplete ? SEARCH_INCOMPLETE : NO_FAILING_CHECKS}</p>;
  }
  return (
    <>
      {isIncomplete ? <p>{SEARCH_INCOMPLETE}</p> : null}
      <ul>
        {checks.checks.map((check) => {
          const state = describeCheckState(check.state, '');
          return (
            <li key={check.key}>
              {describeCheckKind(check.kind)}
              {check.courseId === null ? null : (
                <>
                  {' for '}
                  <CourseLabel courseId={check.courseId} courses={courses} />
                </>
              )}
              : <StatusBadge label={state.label} tone={state.tone} />
              {check.reasonCode === null
                ? null
                : ` ${describeReason(check.reasonCode).explanation}`}
            </li>
          );
        })}
      </ul>
      {omittedCount > 0 ? <p>{omittedSentence(omittedCount)}</p> : null}
    </>
  );
}
