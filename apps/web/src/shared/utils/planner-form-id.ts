/**
 * @file The element id of the planner form, so the conversation can read the form's live values.
 * Only this URL and DOM format is shared, as a constant: no planner logic lives here. The planner
 * form and the chat's chip fill are two users of it, which is the ADR-0007 trigger for promotion.
 * @module @caa/web/shared/utils/planner-form-id
 * @requirement FR-08
 * @see docs/adr/0007-web-feature-and-shared-layout.md
 */

/** The element id of the planner form. */
export const PLANNER_FORM_ID = 'planner-form';
