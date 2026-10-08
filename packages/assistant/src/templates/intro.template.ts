/**
 * @file Fixed intro sentences the model selects by id, and the resolver that never lets model text through.
 * @module @caa/assistant/templates/intro
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { AssistantBlockKind } from '@caa/domain';

/** The ids the model may reply with. The model picks one; the server writes the sentence. */
export const IntroId = {
  ScheduleOptions: 'SCHEDULE_OPTIONS',
  PlanEvidence: 'PLAN_EVIDENCE',
  AcademicSummary: 'ACADEMIC_SUMMARY',
  PolicyResults: 'POLICY_RESULTS',
  ConstraintProposal: 'CONSTRAINT_PROPOSAL',
  CasePreview: 'CASE_PREVIEW',
  AskForDetail: 'ASK_FOR_DETAIL',
  CannotHelp: 'CANNOT_HELP',
} as const;

/** Union of every {@link IntroId} value. */
export type IntroId = (typeof IntroId)[keyof typeof IntroId];

/** Runtime schema for {@link IntroId}. */
export const IntroIdSchema = z.enum(IntroId);

/** Why the server did not use the model's reply, or stopped before calling the model. */
export const GuardReason = {
  IntroNotAnId: 'INTRO_NOT_AN_ID',
  IntroBlockMissing: 'INTRO_BLOCK_MISSING',
  CrisisUnambiguous: 'CRISIS_UNAMBIGUOUS',
} as const;

/** Union of every {@link GuardReason} value. */
export type GuardReason = (typeof GuardReason)[keyof typeof GuardReason];

/** Runtime schema for {@link GuardReason}. */
export const GuardReasonSchema = z.enum(GuardReason);

/** One fixed sentence per id: no slots, no values, no academic facts. */
export const INTRO_TEXTS: Record<IntroId, string> = {
  [IntroId.ScheduleOptions]: 'Here are your schedule options. Each card shows its own checks.',
  [IntroId.PlanEvidence]:
    'Here is your plan. The card shows its own checks and when they were run.',
  [IntroId.AcademicSummary]: 'Here is your academic summary, as shown on your record.',
  [IntroId.PolicyResults]: 'Here are the policy documents that match your question.',
  [IntroId.ConstraintProposal]:
    'Here are the planning choices I understood. Please review them before continuing.',
  [IntroId.CasePreview]: 'Here is a preview of the case. Nothing is sent until you confirm it.',
  [IntroId.AskForDetail]:
    'Could you tell me a little more about what you would like to plan or look up?',
  [IntroId.CannotHelp]:
    'I cannot help with that here. You can use the planning form or ask your advisor.',
};

const DEFAULT_INTRO = 'Please see the note below.';

/** Data-bound ids in fallback precedence, each with the one block kind it needs. */
const DATA_INTROS: readonly (readonly [IntroId, AssistantBlockKind])[] = [
  [IntroId.ScheduleOptions, AssistantBlockKind.ScheduleOptions],
  [IntroId.PlanEvidence, AssistantBlockKind.PlanEvidence],
  [IntroId.AcademicSummary, AssistantBlockKind.AcademicSummary],
  [IntroId.PolicyResults, AssistantBlockKind.PolicyResults],
  [IntroId.ConstraintProposal, AssistantBlockKind.ConstraintProposal],
  [IntroId.CasePreview, AssistantBlockKind.CasePreview],
];

/** What {@link resolveIntro} decided. */
export interface ResolvedIntro {
  /** The fixed sentence to show. */
  readonly text: string;
  /** The id the model chose, or null when the fallback was used. */
  readonly introId: IntroId | null;
  /** Why the model's reply was not used; empty when it was. */
  readonly reasons: readonly GuardReason[];
}

/**
 * Chooses the fixed intro for a turn from its block kinds.
 *
 * @param kinds - The kinds of the blocks produced this turn.
 * @returns A fixed sentence; never model text.
 */
export function fallbackIntro(kinds: readonly AssistantBlockKind[]): string {
  const match = DATA_INTROS.find(([, kind]) => kinds.includes(kind));
  if (match) {
    return INTRO_TEXTS[match[0]];
  }
  return kinds.length === 0 ? INTRO_TEXTS[IntroId.AskForDetail] : DEFAULT_INTRO;
}

// SAFETY: model text never reaches the student. Only a trimmed exact id selects a fixed sentence (ADR-0015 Amendment 1).
/**
 * Resolves the model's reply to a fixed intro.
 *
 * @param replyText - The model's final reply.
 * @param kinds - The kinds of the blocks produced this turn.
 * @returns The fixed text, the chosen id (or null), and the reasons the reply was not used.
 */
export function resolveIntro(
  replyText: string,
  kinds: readonly AssistantBlockKind[],
): ResolvedIntro {
  const parsed = IntroIdSchema.safeParse(replyText.trim());
  if (!parsed.success) {
    return { text: fallbackIntro(kinds), introId: null, reasons: [GuardReason.IntroNotAnId] };
  }
  const id = parsed.data;
  const needed = DATA_INTROS.find(([candidate]) => candidate === id)?.[1];
  const isValid = needed ? kinds.includes(needed) : !DATA_INTROS.some(([, k]) => kinds.includes(k));
  if (!isValid) {
    return { text: fallbackIntro(kinds), introId: null, reasons: [GuardReason.IntroBlockMissing] };
  }
  return { text: INTRO_TEXTS[id], introId: id, reasons: [] };
}
