/**
 * @file The requirements section: the requirement tree as nested lists, with a table view.
 * @module @caa/web/shared/components/requirement-overview
 * @requirement FR-04
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';

import { indexCourses } from '@/shared/utils/course-display';
import { isStandingUnverified } from '@/shared/utils/requirement-state-wording';
import { buildRequirementTree } from '@/shared/utils/requirement-tree';

import { RequirementTable } from './requirement-table';
import { RequirementTreeItem } from './requirement-tree-item';

/** Props for {@link RequirementOverview}. */
export interface RequirementOverviewProps {
  readonly summary: AcademicSummaryResponse;
}

/**
 * Renders the requirements, or nothing when there is no audit (the freshness section says so).
 *
 * @param props - The academic summary.
 * @returns The requirements section, or null.
 */
export function RequirementOverview({ summary }: RequirementOverviewProps): ReactElement | null {
  const { audit, requirements } = summary;
  if (audit === null) {
    return null;
  }
  const isUnverified = isStandingUnverified(summary);
  const courses = indexCourses(summary.courses);
  return (
    <section aria-labelledby="requirements-heading">
      <h2 id="requirements-heading">Degree requirements</h2>
      <p>
        States come from your degree audit and are shown exactly as it reports them.
        {isUnverified ? ' They need verification and are not your current standing.' : ''}
      </p>
      <ul className="requirement-tree" aria-label="Requirement tree">
        {buildRequirementTree(requirements).map((node) => (
          <RequirementTreeItem
            key={node.requirement.sourceRequirementId}
            node={node}
            audit={audit}
            isUnverified={isUnverified}
            courses={courses}
          />
        ))}
      </ul>
      <details>
        <summary>Show requirements as a table</summary>
        <RequirementTable requirements={requirements} audit={audit} isUnverified={isUnverified} />
      </details>
    </section>
  );
}
