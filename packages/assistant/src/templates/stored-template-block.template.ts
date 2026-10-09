/**
 * @file Re-renders a stored referral or notice block reference from its template identity.
 * @module @caa/assistant/templates/stored-template-block
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (Amendment 3)
 */
import {
  AssistantBlockKind,
  type AssistantBlockRef,
  type NoticeCode,
  type SpecialistTopic,
} from '@caa/domain';

import { NOTICE_TEMPLATE_IDS, renderNotice, TEMPLATE_VERSION } from './notice.template';
import {
  CRISIS_SUPPORT_REFERRAL,
  REFERRAL_TEMPLATE_IDS,
  renderReferral,
} from './referral.template';

/** The only stored reference kinds with fixed wording. Academic kinds are not accepted. */
export type StoredTemplateRef = Extract<
  AssistantBlockRef,
  { kind: typeof AssistantBlockKind.Notice | typeof AssistantBlockKind.Referral }
>;

/** A re-rendered notice: the template's current text and version. */
export interface StoredNoticeBlock {
  readonly kind: typeof AssistantBlockKind.Notice;
  readonly code: NoticeCode;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly text: string;
}

/**
 * A re-rendered referral. It carries no policy hit or `asOf`: those belong to a live turn, and
 * the caller adds `policy: null` when it needs the full API block.
 */
export interface StoredReferralBlock {
  readonly kind: typeof AssistantBlockKind.Referral;
  readonly topic: SpecialistTopic;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly text: string;
}

/**
 * Re-renders a stored referral or notice reference (ADR-0015 Amendment 3). Pure; no model call.
 *
 * @param ref - The stored reference: kind, code or topic, template id and version.
 * @returns The block, or null when the id is unknown, the id does not belong to the reference's
 *   code or topic, or the version is not the current `TEMPLATE_VERSION`.
 */
export function renderStoredTemplateBlock(
  ref: StoredTemplateRef,
): StoredNoticeBlock | StoredReferralBlock | null {
  if (ref.templateVersion !== TEMPLATE_VERSION) return null;
  if (ref.kind === AssistantBlockKind.Notice) {
    if (NOTICE_TEMPLATE_IDS[ref.code] !== ref.templateId) return null;
    return {
      kind: ref.kind,
      code: ref.code,
      templateId: ref.templateId,
      templateVersion: TEMPLATE_VERSION,
      text: renderNotice(ref.code),
    };
  }
  const isSupport =
    ref.topic === CRISIS_SUPPORT_REFERRAL.topic &&
    ref.templateId === CRISIS_SUPPORT_REFERRAL.templateId;
  if (!isSupport && REFERRAL_TEMPLATE_IDS[ref.topic] !== ref.templateId) return null;
  return {
    kind: ref.kind,
    topic: ref.topic,
    templateId: ref.templateId,
    templateVersion: TEMPLATE_VERSION,
    text: isSupport ? CRISIS_SUPPORT_REFERRAL.text : renderReferral(ref.topic),
  };
}
