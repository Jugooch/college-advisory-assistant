/**
 * @file The plan revision frozen into a case, for the reviewer: labeled "as saved on <date>" as
 * history, never as the student's current plan, with its freshness at read time and the checks
 * that did not pass, shown as the API returned them.
 * @module @caa/web/features/advisor-cases/components/review-plan
 * @requirement FR-11
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { PlanRevisionView } from '@caa/api-contract';

import { PlanFreshness } from '@/shared/components/plan-freshness';
import { Timestamp } from '@/shared/components/timestamp';
import { indexCourses } from '@/shared/utils/course-display';

import { listSharedChecks } from '../utils/shared-checks';
import { SharedChecksList } from './shared-checks-list';

/** Props for {@link ReviewPlan}. */
export interface ReviewPlanProps {
  readonly revision: PlanRevisionView;
}

/**
 * Renders the frozen revision. Freshness is the API's, as of when this page was loaded.
 *
 * @param props - The revision from the case view's `context`.
 * @returns The plan section.
 */
export function ReviewPlan({ revision }: ReviewPlanProps): ReactElement {
  return (
    <section aria-labelledby="review-plan-heading">
      <h2 id="review-plan-heading">Plan attached to this case</h2>
      <p>
        Revision {revision.revision}, as saved on <Timestamp iso={revision.createdAt} />. This is
        history: the plan exactly as the student saved it, not necessarily their current plan. A
        saved plan is not a registration.
      </p>
      <h3>Is this saved plan still up to date?</h3>
      <PlanFreshness freshness={revision.freshness} />
      <h3>Checks that did not pass</h3>
      <SharedChecksList
        checks={listSharedChecks(revision)}
        courses={indexCourses(revision.result?.courses)}
      />
    </section>
  );
}
