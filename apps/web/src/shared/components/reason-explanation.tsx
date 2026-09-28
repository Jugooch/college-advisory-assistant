/**
 * @file Shows what a reason code means and the next step, from the fixed wording map.
 * @module @caa/web/shared/components/reason-explanation
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ReasonCode } from '@caa/domain';

import { describeReason } from '@/shared/utils/reason-code-wording';

/** Props for {@link ReasonExplanation}. */
export interface ReasonExplanationProps {
  /** Reason code exactly as the API returned it. */
  readonly code: ReasonCode;
}

/**
 * Renders the explanation and next step for a reason code.
 *
 * @param props - The reason code.
 * @returns Two short paragraphs.
 */
export function ReasonExplanation({ code }: ReasonExplanationProps): ReactElement {
  const wording = describeReason(code);
  return (
    <div className="reason">
      <p>{wording.explanation}</p>
      <p>
        <strong>Next step:</strong> {wording.nextStep}
      </p>
    </div>
  );
}
