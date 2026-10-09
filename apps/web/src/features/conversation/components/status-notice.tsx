/**
 * @file The notice for a turn whose status isn't a normal answer, with a link to the planner form.
 * @module @caa/web/features/conversation/components/status-notice
 * @requirement FR-10
 * @requirement NFR-02
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { ModelStatus } from '@caa/domain';

import { FORM_LINK_TEXT, STATUS_NOTICES } from '../utils/conversation-wording';

/** Props for {@link StatusNotice}. */
export interface StatusNoticeProps {
  readonly status: ModelStatus;
  /** Link to the planner form. */
  readonly formHref: string;
}

/**
 * Shows the fixed template for the status, or nothing for an answered or guarded turn.
 *
 * @param props - The status and the form link.
 * @returns The notice, or null.
 */
export function StatusNotice({ status, formHref }: StatusNoticeProps): ReactElement | null {
  const text = STATUS_NOTICES[status];
  if (text === null) {
    return null;
  }
  return (
    <p role="note" className="notice notice--caution">
      {text} <Link href={formHref}>{FORM_LINK_TEXT}</Link>.
    </p>
  );
}
