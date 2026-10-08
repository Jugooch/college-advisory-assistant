/**
 * @file The case preview in chat: exactly what would be shared and with which queue, then a link
 * to the existing case form. Nothing is submitted from chat, the note starts empty, and the
 * transcript is never part of a case.
 * @module @caa/web/features/conversation/components/case-preview-block
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import {
  CHAT_NOT_SHARED,
  describeCaseReason,
  describeSubject,
  WHO_SEES_THIS,
} from '@/shared/utils/case-wording';

import { caseHandoffHref, type CasePreview } from '../utils/case-handoff';

/** Props for {@link CasePreviewBlock}. */
export interface CasePreviewBlockProps {
  readonly block: CasePreview;
  readonly studentId: string;
}

/**
 * Renders the preview. The note is not taken from the block.
 *
 * @param props - The block and the student.
 * @returns The preview card.
 */
export function CasePreviewBlock({ block, studentId }: CasePreviewBlockProps): ReactElement {
  return (
    <section className="chat-card" aria-label="Preview of a request to your advisor">
      <p>Nothing has been sent. This is what would be shared if you continue and send it:</p>
      <ul>
        <li>Reason: {describeCaseReason(block.reason)}</li>
        {block.planRevision === null ? null : <li>Saved plan, revision {block.planRevision}</li>}
        {block.discrepancySubject === null ? null : (
          <li>About: {describeSubject(block.discrepancySubject)}</li>
        )}
        <li>Sent to: {block.queueLabel}</li>
        <li>Your note: you write it on the next page. It starts empty.</li>
      </ul>
      <p>{CHAT_NOT_SHARED}</p>
      <p>{WHO_SEES_THIS}</p>
      <p>
        <Link href={caseHandoffHref(block, studentId)}>Continue to the request form</Link>
      </p>
    </section>
  );
}
