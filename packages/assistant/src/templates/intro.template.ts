/**
 * @file Fallback intros used when the model's intro is missing or rejected by the guard.
 * @module @caa/assistant/templates/intro
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { AssistantBlockKind } from '@caa/domain';

const SCHEDULE_INTRO = 'Here are your schedule options. Each card shows its own checks.';
const PLAN_INTRO = 'Here is your plan. The card shows its own checks and when they were run.';
const SUMMARY_INTRO = 'Here is your academic summary, as shown on your record.';
const POLICY_INTRO = 'Here are the policy documents that match your question.';
const CONSTRAINT_INTRO =
  'Here are the planning choices I understood. Please review them before continuing.';
const CASE_INTRO = 'Here is a preview of the case. Nothing is sent until you confirm it.';
const DEFAULT_INTRO = 'Please see the note below.';

/** Precedence when a turn has several block kinds: the first match supplies the intro. */
const INTRO_BY_KIND: readonly (readonly [AssistantBlockKind, string])[] = [
  [AssistantBlockKind.ScheduleOptions, SCHEDULE_INTRO],
  [AssistantBlockKind.PlanEvidence, PLAN_INTRO],
  [AssistantBlockKind.AcademicSummary, SUMMARY_INTRO],
  [AssistantBlockKind.PolicyResults, POLICY_INTRO],
  [AssistantBlockKind.ConstraintProposal, CONSTRAINT_INTRO],
  [AssistantBlockKind.CasePreview, CASE_INTRO],
  [AssistantBlockKind.Referral, DEFAULT_INTRO],
  [AssistantBlockKind.Notice, DEFAULT_INTRO],
];

/**
 * Chooses the fixed intro for a turn from its block kinds.
 *
 * @param kinds - The kinds of the blocks produced this turn.
 * @returns A fixed sentence; never model text.
 */
export function fallbackIntro(kinds: readonly AssistantBlockKind[]): string {
  const match = INTRO_BY_KIND.find(([kind]) => kinds.includes(kind));
  return match ? match[1] : DEFAULT_INTRO;
}
