/**
 * @file A machine-readable timestamp with a UTC display label.
 * @module @caa/web/shared/components/timestamp
 */
import type { ReactElement } from 'react';

import { formatTimestamp } from '@/shared/utils/format-display';

/** Props for {@link Timestamp}. */
export interface TimestampProps {
  /** ISO 8601 with offset, as the API returns it. */
  readonly iso: string;
}

/**
 * Renders a `<time>` element for an API timestamp.
 *
 * @param props - The timestamp.
 * @returns The time element.
 */
export function Timestamp({ iso }: TimestampProps): ReactElement {
  return <time dateTime={iso}>{formatTimestamp(iso)}</time>;
}
