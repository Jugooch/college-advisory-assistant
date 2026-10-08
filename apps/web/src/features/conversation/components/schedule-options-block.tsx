/**
 * @file The schedule-options block in chat: the search result rendered by the shared results
 * card from the block's structured fields, with the same check wording as the planner.
 * Nothing is recomputed here.
 * @module @caa/web/features/conversation/components/schedule-options-block
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';

import { ScheduleResults } from '@/shared/components/schedule-results';

/** Props for {@link ScheduleOptionsBlock}. */
export interface ScheduleOptionsBlockProps {
  readonly block: Extract<AssistantBlock, { kind: 'SCHEDULE_OPTIONS' }>;
}

/**
 * Renders the search result as the planner does.
 *
 * @param props - The block.
 * @returns The results section.
 */
export function ScheduleOptionsBlock({ block }: ScheduleOptionsBlockProps): ReactElement {
  return <ScheduleResults result={block.result} courses={new Map()} isHeadingFocused={false} />;
}
