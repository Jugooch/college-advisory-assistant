/**
 * @file Client state for the clear-conversation confirmation: asking, pending, and focus.
 * @module @caa/web/features/conversation/hooks/use-clear-confirmation
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type RefObject, useEffect, useRef, useState, useTransition } from 'react';

import type { ClearResult } from '../utils/conversation-state';

/** What {@link useClearConfirmation} needs. */
export interface ClearConfirmationInput {
  readonly studentId: string;
  readonly termId: string;
  readonly clearAction: (studentId: string, termId: string) => Promise<ClearResult>;
  readonly onCleared: () => void;
  readonly onFailed: (problem: { message: string; requestId: string | null }) => void;
}

/** What {@link useClearConfirmation} returns. */
export interface ClearConfirmationState {
  readonly isAsking: boolean;
  readonly isPending: boolean;
  readonly startRef: RefObject<HTMLButtonElement | null>;
  readonly confirmRef: RefObject<HTMLButtonElement | null>;
  readonly ask: () => void;
  /** Declines and returns focus to the start control. */
  readonly keep: () => void;
  readonly confirm: () => void;
}

/**
 * Holds the confirmation state. Asking moves focus to the confirm button; keeping returns it to
 * the start control. After a clear, the caller moves focus to its input.
 *
 * @param input - The student, term, action and callbacks.
 * @returns The state and handlers.
 */
export function useClearConfirmation(input: ClearConfirmationInput): ClearConfirmationState {
  const { studentId, termId, clearAction, onCleared, onFailed } = input;
  const [isAsking, setIsAsking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const startRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isKept = useRef(false);
  useEffect(() => {
    if (isAsking) {
      confirmRef.current?.focus();
    } else if (isKept.current) {
      isKept.current = false;
      startRef.current?.focus();
    }
  }, [isAsking]);
  const confirm = (): void => {
    if (isPending) {
      return;
    }
    startTransition(async () => {
      const result = await clearAction(studentId, termId);
      setIsAsking(false);
      if (result.kind === 'cleared') {
        onCleared();
      } else {
        onFailed({ message: result.message, requestId: result.requestId });
      }
    });
  };
  return {
    isAsking,
    isPending,
    startRef,
    confirmRef,
    ask: () => {
      setIsAsking(true);
    },
    keep: () => {
      isKept.current = true;
      setIsAsking(false);
    },
    confirm,
  };
}
