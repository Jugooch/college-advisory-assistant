/**
 * @file The plan revision frozen into a case: labeled "as saved on <date>", with its freshness and
 * the checks that did not pass. It is the revision the advisor sees, never a newer one.
 * @module @caa/web/features/advisor-cases/components/frozen-plan
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

/** Props for {@link FrozenPlan}. */
export interface FrozenPlanProps {
  readonly revision: PlanRevisionView;
}

/**
 * Renders the frozen revision. Freshness is the API's, at read time.
 *
 * @param props - The revision from the case view's `context`.
 * @returns The frozen plan section.
 */
export function FrozenPlan({ revision }: FrozenPlanProps): ReactElement {
  return (
    <section aria-label={`Plan revision ${String(revision.revision)} attached to this case`}>
      <h4>Plan attached to this case</h4>
      <p>
        Revision {revision.revision}, as saved on <Timestamp iso={revision.createdAt} />. Your
        advisor sees this revision, not a newer one. It is a saved plan, not a registration.
      </p>
      <PlanFreshness freshness={revision.freshness} />
      <h5>Checks that did not pass</h5>
      <SharedChecksList
        checks={listSharedChecks(revision)}
        courses={indexCourses(revision.result?.courses)}
      />
    </section>
  );
}
