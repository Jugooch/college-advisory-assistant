/**
 * @file Shows whether the audit reflects the record and matches its program, as the API reports.
 * Uncertainty is stated plainly and never shown as current standing.
 * @module @caa/web/shared/components/audit-freshness
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { type ReactElement, useId } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';
import { CheckState } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { ReasonExplanation } from '@/shared/components/reason-explanation';
import { formatTimestamp } from '@/shared/utils/format-display';
import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';
import { isStandingUnverified } from '@/shared/utils/requirement-state-wording';

/** Props for {@link AuditFreshness}. */
export interface AuditFreshnessProps {
  readonly summary: AcademicSummaryResponse;
  /** Level of this card's heading; its Defaults to `2`. */
  readonly headingLevel?: HeadingLevel;
}

/** One freshness verdict as the API returns it: PASS with no reason, or UNKNOWN with one. */
type Verdict =
  | NonNullable<AcademicSummaryResponse['auditReflectsRecord']>
  | NonNullable<AcademicSummaryResponse['programCatalogConsistency']>;

/** Props for the verdict row. */
interface VerdictItemProps {
  readonly title: string;
  readonly verdict: Verdict;
  /** The record time a PASS holds for. ISO 8601 with offset. */
  readonly recordAsOf: string;
}

/**
 * Renders one verdict row.
 *
 * @param props - Its title, the verdict, and the record time.
 * @returns The list item.
 */
function VerdictItem({ title, verdict, recordAsOf }: VerdictItemProps): ReactElement {
  return (
    <li>
      {title}:{' '}
      {verdict.state === CheckState.Pass ? (
        <StatusBadge label={`Passed as of ${formatTimestamp(recordAsOf)}`} tone="positive" />
      ) : (
        <>
          <StatusBadge label="Needs verification" tone="caution" />
          <ReasonExplanation code={verdict.reasonCode} />
        </>
      )}
    </li>
  );
}

/**
 * Renders the audit freshness section, or the no-audit state.
 *
 * @param props - The academic summary.
 * @returns The freshness section.
 */
export function AuditFreshness({ summary, headingLevel = 2 }: AuditFreshnessProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  const { auditReflectsRecord, programCatalogConsistency } = summary;
  if (auditReflectsRecord === null || programCatalogConsistency === null) {
    return (
      <section className="notice notice--caution" aria-labelledby={headingId}>
        <Heading id={headingId}>Degree audit</Heading>
        <p>
          <StatusBadge label="No degree audit on file" tone="caution" />
        </p>
        <p>Requirement progress can’t be shown without an audit.</p>
        <p>
          <strong>Next step:</strong> Ask your advisor to run a degree audit for you.
        </p>
      </section>
    );
  }
  const isUnverified = isStandingUnverified(summary);
  const recordAsOf = summary.studentSnapshot.sourceEffectiveAt;
  return (
    <section
      className={isUnverified ? 'notice notice--caution' : 'notice'}
      aria-labelledby={headingId}
    >
      <Heading id={headingId}>
        {isUnverified ? 'Degree audit needs verification' : 'Degree audit'}
      </Heading>
      <ul>
        <VerdictItem
          title="Audit reflects your record"
          verdict={auditReflectsRecord}
          recordAsOf={recordAsOf}
        />
        <VerdictItem
          title="Audit is for your program and catalog"
          verdict={programCatalogConsistency}
          recordAsOf={recordAsOf}
        />
      </ul>
    </section>
  );
}
