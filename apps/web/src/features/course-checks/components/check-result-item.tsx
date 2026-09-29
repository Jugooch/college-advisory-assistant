/**
 * @file One check dimension: its state in words, what it means, the next step, and evidence.
 * @module @caa/web/features/course-checks/components/check-result-item
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { ReactElement } from 'react';

import type { CheckResult } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { ReasonExplanation } from '@/shared/components/reason-explanation';
import { describeCheckState } from '@/shared/utils/check-state-wording';

import { CheckEvidence } from './check-evidence';

/** Props for {@link CheckResultItem}. */
export interface CheckResultItemProps {
  /** Name of the dimension, for example `Prerequisite`. */
  readonly dimension: string;
  /** The check, or null when no rule exists for it (shown as not checked, never as passed). */
  readonly check: CheckResult | null;
  /** The as-of text a PASS holds for. */
  readonly asOf: string;
}

/**
 * Renders one dimension as a list item with its own heading.
 *
 * @param props - The dimension, its check, and the as-of text.
 * @returns The list item.
 */
export function CheckResultItem({ dimension, check, asOf }: CheckResultItemProps): ReactElement {
  if (check === null) {
    return (
      <li className="check">
        <h4>{dimension}</h4>
        <StatusBadge label="No rule to check" tone="neutral" />
        <p>This course has no {dimension.toLowerCase()} rule, so nothing was checked here.</p>
      </li>
    );
  }
  const display = describeCheckState(check.state, asOf);
  return (
    <li className="check">
      <h4>{dimension}</h4>
      <StatusBadge label={display.label} tone={display.tone} />
      {check.reasonCode === undefined ? null : <ReasonExplanation code={check.reasonCode} />}
      <CheckEvidence dimension={dimension} check={check} />
    </li>
  );
}
