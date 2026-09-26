/**
 * @file Shows whether the API is reachable.
 * @module @caa/web/features/system-status/components/system-status-card
 */
import type { ReactElement } from 'react';

import type { HealthResponse } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';

/** Props for {@link SystemStatusCard}. */
export interface SystemStatusCardProps {
  /** Health payload, or null when the API could not be reached. */
  readonly health: HealthResponse | null;
}

/**
 * Renders the API status with its version and check time.
 *
 * @param props - Health payload or null.
 * @returns The status card.
 */
export function SystemStatusCard({ health }: SystemStatusCardProps): ReactElement {
  if (health === null) {
    return (
      <section aria-labelledby="system-status-heading">
        <h2 id="system-status-heading">System status</h2>
        <StatusBadge label="API unavailable" tone="negative" />
      </section>
    );
  }
  return (
    <section aria-labelledby="system-status-heading">
      <h2 id="system-status-heading">System status</h2>
      <StatusBadge label="API available" tone="positive" />
      <p>
        Version {health.version}, checked at{' '}
        <time dateTime={health.checkedAt}>{health.checkedAt}</time>
      </p>
    </section>
  );
}
