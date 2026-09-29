/**
 * @file Wording for the rule leaves and credit arithmetic behind a check, from structured
 * evidence only.
 * @module @caa/web/features/course-checks/utils/decisive-leaf-wording
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { CreditLoadEvidence, DecisiveLeaf, Grade } from '@caa/domain';

import { formatCredits, formatTimestamp } from '@/shared/utils/format-display';

/**
 * Describes a required grade.
 *
 * @param grade - The leaf's minimum grade.
 * @returns For example `C or higher`, or `a grade of P`.
 */
function describeRequiredGrade(grade: Grade): string {
  switch (grade.scheme) {
    case 'LETTER':
    case 'NUMERIC':
      return `${grade.value} or higher`;
    case 'PASS_FAIL':
    case 'UNKNOWN':
      return `a grade of ${grade.value}`;
  }
}

/**
 * Describes what one decisive leaf requires.
 *
 * @param leaf - A decisive leaf from check evidence.
 * @returns For example `Requires C or higher in course <id>`.
 */
export function describeLeaf(leaf: DecisiveLeaf): string {
  if (leaf.type === 'UNSUPPORTED') {
    return `Rule text the planner can’t interpret: “${leaf.sourceText}”`;
  }
  const grade =
    leaf.requiredGrade === null ? 'a passing grade' : describeRequiredGrade(leaf.requiredGrade);
  return `Requires ${grade} in course ${leaf.courseId}`;
}

/**
 * Describes the credit arithmetic of a credit-load check.
 *
 * @param load - The credit-load evidence.
 * @returns For example `Total 15 credits; this term’s load is 12 to 18 credits.`
 */
export function describeCreditLoad(load: CreditLoadEvidence): string {
  const total = formatCredits(load.totalCreditsHundredths);
  const min = formatCredits(load.minCreditsHundredths);
  const max = formatCredits(load.maxCreditsHundredths);
  return `Total ${total} credits; this term’s load is ${min} to ${max} credits.`;
}

/**
 * Describes the times every course-check result holds for.
 *
 * @param pinned - The response's pinned inputs.
 * @returns For example `Sep 12, 2026, 2:00 PM UTC (record) and Sep 10, 2026, 9:00 AM UTC (audit)`.
 */
export function describeAsOf(pinned: {
  readonly studentRecordEffectiveAt: string;
  readonly auditRecordEffectiveAt: string;
}): string {
  const record = formatTimestamp(pinned.studentRecordEffectiveAt);
  const audit = formatTimestamp(pinned.auditRecordEffectiveAt);
  return `${record} (record) and ${audit} (audit)`;
}
