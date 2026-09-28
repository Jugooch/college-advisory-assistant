/**
 * @file States what a requirement still needs, as the audit measures it.
 * @module @caa/web/features/academic-summary/components/requirement-remaining
 * @requirement FR-04
 */
import type { ReactElement } from 'react';

import { formatCredits } from '@/shared/utils/format-display';

import type { SummaryRequirement } from '../utils/requirement-tree';

/** Props for {@link RequirementRemaining}. */
export interface RequirementRemainingProps {
  readonly requirement: SummaryRequirement;
}

/**
 * Renders the audit's remaining credits and courses, or that the audit gives no quantity.
 *
 * @param props - The requirement.
 * @returns A short text.
 */
export function RequirementRemaining({ requirement }: RequirementRemainingProps): ReactElement {
  const parts: string[] = [];
  if (requirement.remainingCreditsHundredths !== null) {
    parts.push(`${formatCredits(requirement.remainingCreditsHundredths)} credits`);
  }
  if (requirement.remainingCourseCount !== null) {
    parts.push(`${String(requirement.remainingCourseCount)} courses`);
  }
  return <>{parts.length === 0 ? 'No quantity given by the audit' : parts.join(', ')}</>;
}
