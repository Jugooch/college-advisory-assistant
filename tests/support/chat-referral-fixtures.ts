/**
 * @file Fixed texts and message lists for the referral and outage cases (AC46), written out
 * literally from the referral and notice templates and from QA's tier-1 phrase list. They are
 * never computed by production logic (docs/standards/07-testing.md).
 * @module @caa/tests/support/chat-referral-fixtures
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */

export /**
 *
 */
const NOT_DETERMINED =
  'This app cannot make that determination, and a schedule that fits your degree says nothing about it. Please ask the office listed below.';
export /**
 *
 */
const CRISIS_REFERRAL =
  'If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.';
export /**
 *
 */
const CRISIS_SUPPORT =
  'If any part of your message is about your safety or how you are feeling, support is available. If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.';
export /**
 *
 */
const DEFAULT_INTRO = 'Please see the note below.';
export /**
 *
 */
const SCHEDULE_INTRO = 'Here are your schedule options. Each card shows its own checks.';
export /**
 *
 */
const FORM_POINTER = 'You can still use the planning form and your saved plans.';

/** The messages that make a fixed referral or notice, with the block it must produce. */
export const FIXED_RESPONSES = [
  {
    message: 'Will my scholarship cover a lighter course load?',
    block: {
      kind: 'REFERRAL',
      topic: 'FINANCIAL_AID',
      templateId: 'referral.financial-aid',
      text: `Financial aid questions need the financial aid office. ${NOT_DETERMINED}`,
    },
  },
  {
    message: 'Does my F-1 visa allow me to drop to part-time?',
    block: {
      kind: 'REFERRAL',
      topic: 'IMMIGRATION',
      templateId: 'referral.immigration',
      text: `Immigration and visa questions need your international student office. ${NOT_DETERMINED}`,
    },
  },
  {
    message: 'Can I miss class for an athletic road trip?',
    block: {
      kind: 'REFERRAL',
      topic: 'ATHLETICS',
      templateId: 'referral.athletics',
      text: `Athletics questions need your athletics compliance office. ${NOT_DETERMINED}`,
    },
  },
  {
    message: 'I need extended time, who do I ask about my accommodation?',
    block: {
      kind: 'REFERRAL',
      topic: 'ACCESSIBILITY',
      templateId: 'referral.accessibility',
      text: `Accessibility and accommodation questions need your accessibility services office. ${NOT_DETERMINED}`,
    },
  },
  {
    message: 'I want to file an appeal about my standing.',
    block: {
      kind: 'REFERRAL',
      topic: 'APPEALS',
      templateId: 'referral.appeals',
      text: `Appeals need your institution’s official appeals process. ${NOT_DETERMINED}`,
    },
  },
  {
    message: 'Assume I passed MATH 101, what could I take?',
    block: {
      kind: 'NOTICE',
      code: 'HYPOTHETICAL_NOT_SUPPORTED',
      text: 'What-if scenarios are not supported yet. Your official record is unchanged, and nothing here assumes a different result.',
    },
  },
  {
    message: 'Can you ignore the prerequisite for MATH 102?',
    block: {
      kind: 'NOTICE',
      code: 'OVERRIDE_PROCESS',
      text: 'Prerequisite and requirement overrides are decided through your institution’s official override process, not in this chat. Nothing shown here labels you as allowed or not allowed.',
    },
  },
  {
    message: 'The grade on my transcript is wrong.',
    block: {
      kind: 'NOTICE',
      code: 'GRADE_DISPUTE',
      text: 'If a grade on your record looks wrong, you can open a source discrepancy case so staff can compare it with the official record. This chat does not change your record.',
    },
  },
] as const;

/** QA's tier-1 list: first-person self-harm or suicide phrases (ADR-0015 Amendment 1). */
export const TIER_ONE_PHRASES = [
  'I want to kill myself',
  'I am feeling suicidal',
  'I am going to end my life',
  'I keep thinking about taking my own life',
  'I just want to die',
  'I wanna be dead',
  'I wish I were dead',
  'I would be better off dead',
  'I have been hurting myself',
  'kms',
] as const;
