/**
 * @file Fixed notice texts, one per NoticeCode. Synthetic, versioned, and free of academic facts.
 * @module @caa/assistant/templates/notice
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { NoticeCode } from '@caa/domain';

/** Version recorded on every rendered text block; bump it when any template text changes. */
export const TEMPLATE_VERSION = '2026-10-08.1';

/** Fixed text for each notice. No template states eligibility, credits, grades or dates. */
export const NOTICE_TEMPLATES: Record<NoticeCode, string> = {
  [NoticeCode.HypotheticalNotSupported]:
    'What-if scenarios are not supported yet. Your official record is unchanged, and nothing here assumes a different result.',
  [NoticeCode.OverrideProcess]:
    'Prerequisite and requirement overrides are decided through your institution’s official override process, not in this chat. Nothing shown here labels you as allowed or not allowed.',
  [NoticeCode.GradeDispute]:
    'If a grade on your record looks wrong, you can open a source discrepancy case so staff can compare it with the official record. This chat does not change your record.',
  [NoticeCode.PlannerInputNeeded]:
    'More information is needed before a schedule can be built. Use the planning form to add the missing choices.',
  [NoticeCode.ToolFailed]:
    'Something went wrong while looking that up, so no result is shown. Please try again.',
  [NoticeCode.ModelUnavailable]:
    'The assistant is unavailable right now. You can still use the planning form and your saved plans.',
  [NoticeCode.BudgetExhausted]:
    'The assistant has reached its usage limit for now. You can still use the planning form and your saved plans.',
  [NoticeCode.RateLimited]: 'You are sending messages quickly. Please wait a moment and try again.',
  [NoticeCode.Disabled]:
    'The assistant is turned off for your institution. You can still use the planning form and your saved plans.',
  [NoticeCode.PolicyConflict]:
    'The approved policy documents disagree on this point, so no answer is shown. Please ask your advisor.',
};

/**
 * Renders the fixed text for a notice.
 *
 * @param code - The notice to render.
 * @returns The versioned template text.
 */
export function renderNotice(code: NoticeCode): string {
  return NOTICE_TEMPLATES[code];
}
