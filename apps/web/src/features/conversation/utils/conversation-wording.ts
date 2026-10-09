/**
 * @file Fixed wording for the chat panel: one template per model status that isn't a normal
 * answer. These are client templates, never model text, and each says the planner form still works.
 * @module @caa/web/features/conversation/utils/conversation-wording
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { ModelStatus } from '@caa/domain';

/** Shown under the panel heading at all times: chat never registers or changes anything. */
export const NOT_REGISTRATION_NOTE =
  'This chat is not registration. It doesn’t register you for anything or change your record.';

/** Shown when the API says chat is unavailable. */
export const UNAVAILABLE_MESSAGE =
  'Chat is unavailable right now. The planner form works the same without it.';

/** The planner form still works; used in every non-answer notice. */
const FORM_STILL_WORKS = 'The planner form still works.';

/** The notice for each status that isn't a normal answer. `ANSWERED` and `GUARDED` have none. */
export const STATUS_NOTICES: Readonly<Record<ModelStatus, string | null>> = {
  [ModelStatus.Answered]: null,
  [ModelStatus.Guarded]: null,
  [ModelStatus.BudgetExhausted]: `The assistant has reached its limit for now. ${FORM_STILL_WORKS}`,
  [ModelStatus.ModelUnavailable]: `The assistant couldn’t answer just now. ${FORM_STILL_WORKS}`,
  [ModelStatus.RateLimited]: `You’ve sent several messages quickly. Wait a little, then try again. ${FORM_STILL_WORKS}`,
  [ModelStatus.Disabled]: `The assistant is turned off. ${FORM_STILL_WORKS}`,
};

/** The text of the link to the form, shown with each status notice. */
export const FORM_LINK_TEXT = 'Go to the planner form';

/** Announced once when a reply arrives. */
export const REPLY_ANNOUNCEMENT = 'The assistant replied.';

/** Announced once after the transcript was reloaded because it changed elsewhere. */
export const CONFLICT_ANNOUNCEMENT =
  'The conversation changed since you loaded it, so it was reloaded. Your message is still in the box; send it again.';

/** Announced once after the transcript is cleared. */
export const CLEARED_ANNOUNCEMENT = 'Conversation cleared.';

/** Shown when the message couldn't be read, so nothing was sent. */
export const REJECTED_MESSAGE = 'That message couldn’t be sent. Check it and try again.';

/** The text of the link to Help and cases. */
export const HELP_LINK_TEXT = 'Open Help and cases';

/** A reload shows a stored referral by its template only, so its wording can't be shown again. */
export const STORED_REFERRAL_UNAVAILABLE =
  'The assistant showed you a referral to a specialist office here. Its details aren’t saved with the conversation. Contact information is always available.';

/** A reload shows a stored notice by its template only, so its wording can't be shown again. */
export const STORED_NOTICE_UNAVAILABLE =
  'The assistant showed you a notice here. Its wording isn’t saved with the conversation.';
