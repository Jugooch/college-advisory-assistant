/**
 * @file Text-labelled status badge. State is never conveyed by color alone.
 * @module @caa/web/components/ui/status-badge
 */
import type { ReactElement } from 'react';

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  /** Visible label, for example "Available". */
  readonly label: string;
  /** Visual tone. The label must carry the meaning on its own. */
  readonly tone: 'positive' | 'negative' | 'neutral';
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
