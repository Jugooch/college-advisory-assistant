/**
 * @file Text-labelled status badge. State is never conveyed by color alone.
 * @module @caa/web/components/ui/status-badge
 */
import type { ReactElement } from 'react';

/**
 * Visual tone of a badge. `caution` is for states that need attention but aren't failures, such
 * as needs verification or conditional; it is never used for a pass.
 */
export type StatusTone = 'positive' | 'negative' | 'caution' | 'neutral';

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  /** Visible label, for example "Available". */
  readonly label: string;
  /** Visual tone. The label must carry the meaning on its own. */
  readonly tone: StatusTone;
}

/**
 * Renders a short status label.
 *
 * @param props - Label and tone.
 * @returns The badge element.
 */
export function StatusBadge({ label, tone }: StatusBadgeProps): ReactElement {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
