/**
 * @file One check dimension: its state in words, what it means, the next step, and evidence.
 * @module @caa/web/shared/components/check-result-item
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { ReactElement } from 'react';

import type { CheckResult } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { CheckEvidence } from '@/shared/components/check-evidence';
import { ReasonExplanation } from '@/shared/components/reason-explanation';
import type { CampusLookup } from '@/shared/utils/campus-display';
import { describeCheckState } from '@/shared/utils/check-state-wording';
import type { CourseLookup } from '@/shared/utils/course-display';

/** Props for {@link CheckResultItem}. */
export interface CheckResultItemProps {
  /** Name of the dimension, for example `Prerequisite`. */
  readonly dimension: string;
  /** The check, or null when no rule exists for it (shown as not checked, never as passed). */
  readonly check: CheckResult | null;
  /** The as-of text a PASS holds for. */
  readonly asOf: string;
  /** Catalog display entries by course ID, to name the courses in the evidence. */
  readonly courses: CourseLookup;
  /** Campus names by ID, to name the campuses in schedule issues. */
  readonly campuses?: CampusLookup | undefined;
  /** Short lowercase name of the rule for the "no rule" message; defaults to the dimension. */
  readonly ruleName?: string;
}

/**
 * Renders one dimension as a list item with its own heading.
 *
 * @param props - The dimension, its check, the as-of text, and the display entries.
 * @returns The list item.
 */
export function CheckResultItem({
  dimension,
  check,
  asOf,
  courses,
  campuses,
  ruleName,
}: CheckResultItemProps): ReactElement {
  if (check === null) {
    return (
      <li className="check">
        <h4>{dimension}</h4>
        <StatusBadge label="No rule to check" tone="neutral" />
        <p>
          This course has no {ruleName ?? dimension.toLowerCase()} rule, so nothing was checked
          here.
        </p>
      </li>
    );
  }
  const display = describeCheckState(check.state, asOf);
  return (
    <li className="check">
      <h4>{dimension}</h4>
      <StatusBadge label={display.label} tone={display.tone} />
      {check.reasonCode === undefined ? null : <ReasonExplanation code={check.reasonCode} />}
      <CheckEvidence dimension={dimension} check={check} courses={courses} campuses={campuses} />
    </li>
  );
}
