/**
 * @file The plan detail's freshness banner: a heading that says whether the draft is up to date,
 * one plain line per reason, what to do next, and when it was last checked. Text carries the
 * meaning, never color alone.
 * @module @caa/web/features/plan-drafts/components/freshness-banner
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { PlanFreshnessView } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeFreshness, describeStaleReason } from '@/shared/utils/freshness-wording';

import { describeFreshnessBanner } from '../utils/plan-detail-wording';

/** Props for {@link FreshnessBanner}. */
export interface FreshnessBannerProps {
  readonly freshness: PlanFreshnessView;
}

/**
 * Renders the freshness exactly as the API returned it.
 *
 * @param props - The freshness view.
 * @returns The banner section.
 */
export function FreshnessBanner({ freshness }: FreshnessBannerProps): ReactElement {
  const banner = describeFreshnessBanner(freshness.state);
  const badge = describeFreshness(freshness.state);
  return (
    <section aria-labelledby="freshness-heading" className="notice">
      <h2 id="freshness-heading">{banner.heading}</h2>
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
