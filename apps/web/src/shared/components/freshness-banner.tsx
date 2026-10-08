/**
 * @file The plan detail's freshness banner: a heading that says whether the draft is up to date,
 * one plain line per reason, what to do next, and when it was last checked. Text carries the
 * meaning, never color alone.
 * @module @caa/web/shared/components/freshness-banner
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type ReactElement, useId } from 'react';

import type { PlanFreshnessView } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeFreshness, describeStaleReason } from '@/shared/utils/freshness-wording';
import { type HeadingLevel, headingTag } from '@/shared/utils/heading-level';
import { describeFreshnessBanner } from '@/shared/utils/plan-detail-wording';

/** Props for {@link FreshnessBanner}. */
export interface FreshnessBannerProps {
  readonly freshness: PlanFreshnessView;
  /** Level of this card's heading; its sub-headings sit one level below. Defaults to `2`. */
  readonly headingLevel?: HeadingLevel;
}

/**
 * Renders the freshness exactly as the API returned it.
 *
 * @param props - The freshness view.
 * @returns The banner section.
 */
export function FreshnessBanner({
  freshness,
  headingLevel = 2,
}: FreshnessBannerProps): ReactElement {
  const headingId = useId();
  const Heading = headingTag(headingLevel);
  const banner = describeFreshnessBanner(freshness.state);
  const badge = describeFreshness(freshness.state);
  return (
    <section aria-labelledby={headingId} className="notice">
      <Heading id={headingId}>{banner.heading}</Heading>
      <p>
        <StatusBadge label={badge.label} tone={badge.tone} /> Checked{' '}
        <Timestamp iso={freshness.checkedAt} />
      </p>
      <p>{banner.explanation}</p>
      {freshness.reasons.length === 0 ? null : (
        <ul>
          {freshness.reasons.map((reason) => (
            <li key={reason}>{describeStaleReason(reason)}</li>
          ))}
        </ul>
      )}
      <p>{banner.nextStep}</p>
    </section>
  );
}
