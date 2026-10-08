'use client';
/**
 * @file The assistant's proposed schedule limits as editable chips. Nothing is applied until the
 * student confirms a chip, and only the student can make one required.
 * @module @caa/web/features/conversation/components/constraint-proposal
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ProposedConstraint } from '@caa/api-contract';

import { useConstraintChips } from '../hooks/use-constraint-chips';
import { useFillPlanner } from '../hooks/use-fill-planner';
import { ConstraintChip } from './constraint-chip';

/** Props for {@link ConstraintProposal}. */
export interface ConstraintProposalProps {
  readonly constraints: readonly ProposedConstraint[];
}

/**
 * Renders one chip per proposed constraint.
 *
 * @param props - The proposed constraints.
 * @returns The chip list.
 */
export function ConstraintProposal({ constraints }: ConstraintProposalProps): ReactElement {
  const state = useConstraintChips(constraints, useFillPlanner());
  return (
    <section className="chat-card" aria-label="Suggested limits">
      <p>
        These are suggestions. Nothing is added to your form until you confirm it, and every one
        starts as a preference.
      </p>
      <ul className="chip-list">
        {state.chips.map((chip) => (
          <ConstraintChip key={chip.id} chip={chip} actions={state} />
        ))}
      </ul>
      <div role="status" aria-live="polite" className="chat-live">
        {state.announcement}
      </div>
    </section>
  );
}
