/**
 * @file Client state for the proposed-constraint chips. A chip changes nothing outside this
 * list until the student confirms it; every chip starts preferred.
 * @module @caa/web/features/conversation/hooks/use-constraint-chips
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { useState } from 'react';

import type { ProposedConstraint } from '@caa/api-contract';
import type { ConstraintStrength, ScheduleConstraint } from '@caa/domain';

import { withStrength } from '../utils/chip-draft';
import type { PlannerFill } from './use-fill-planner';

/** One chip's state. */
export interface Chip {
  readonly id: number;
  readonly constraint: ScheduleConstraint;
  /** The priority to use if the student switches back to preferred. */
  readonly rank: number;
  readonly status: 'pending' | 'confirmed' | 'dismissed';
  readonly isEditing: boolean;
  /** Why the last confirm could not place the chip, or null. */
  readonly problem: string | null;
}

/** What {@link useConstraintChips} returns. */
export interface ConstraintChips {
  readonly chips: readonly Chip[];
  readonly announcement: string;
  readonly setStrength: (id: number, strength: ConstraintStrength) => void;
  readonly setEditing: (id: number, isEditing: boolean) => void;
  readonly saveEdit: (id: number, constraint: ScheduleConstraint) => void;
  readonly dismiss: (id: number) => void;
  readonly confirm: (id: number) => void;
}

/**
 * Starts the chips. A constraint the form already holds shows as added, so a reload does not
 * offer it again.
 *
 * @param proposed - The proposal's constraints.
 * @param planner - Tells whether the form already holds a constraint.
 * @returns One chip per constraint.
 */
function startChips(
  proposed: readonly ProposedConstraint[],
  planner: PlannerFill,
): readonly Chip[] {
  return proposed.map(({ constraint }, id) => ({
    id,
    constraint,
    rank: constraint.priorityRank ?? 1,
    status: planner.isFilled(constraint) ? 'confirmed' : 'pending',
    isEditing: false,
    problem: null,
  }));
}

/**
 * Holds the chips.
 *
 * @param proposed - The proposal's constraints, all preferred.
 * @param planner - Fills a confirmed constraint into the planner form and tells whether the
 * form already holds one.
 * @returns The chips and their handlers.
 */
export function useConstraintChips(
  proposed: readonly ProposedConstraint[],
  planner: PlannerFill,
): ConstraintChips {
  const [chips, setChips] = useState<readonly Chip[]>(() => startChips(proposed, planner));
  const [announcement, setAnnouncement] = useState('');
  const patch = (id: number, change: Partial<Chip>): void => {
    setChips((all) => all.map((chip) => (chip.id === id ? { ...chip, ...change } : chip)));
  };
  const find = (id: number): Chip | undefined => chips.find((chip) => chip.id === id);
  return {
    chips,
    announcement,
    setStrength: (id, strength) => {
      const chip = find(id);
      if (chip !== undefined) {
        patch(id, { constraint: withStrength(chip.constraint, strength, chip.rank) });
      }
    },
    setEditing: (id, isEditing) => {
      patch(id, { isEditing });
    },
    saveEdit: (id, constraint) => {
      patch(id, {
        constraint,
        rank: constraint.priorityRank ?? find(id)?.rank ?? 1,
        isEditing: false,
      });
    },
    dismiss: (id) => {
      patch(id, { status: 'dismissed' });
      setAnnouncement('Suggestion dismissed. Nothing was changed.');
    },
    confirm: (id) => {
      const chip = find(id);
      if (chip === undefined) {
        return;
      }
      const result = planner.fill(chip.constraint);
      if (result.kind === 'filled' || result.kind === 'present') {
        patch(id, { status: 'confirmed', problem: null });
        setAnnouncement(
          result.kind === 'filled'
            ? 'Added to the form. Review it, then confirm the search.'
            : 'Already on the form. Nothing was added twice.',
        );
      } else {
        patch(id, { problem: result.message });
        setAnnouncement(result.message);
      }
    },
  };
}
