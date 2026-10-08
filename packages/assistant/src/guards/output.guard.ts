/**
 * @file Deterministic guard for the model's intro: over-inclusive, replaces and never truncates.
 * @module @caa/assistant/guards/output
 * @requirement FR-10
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */

/** Longest intro the guard accepts, in UTF-16 code units. */
export const MAX_INTRO_LENGTH = 600;

/** Why the guard rejected an intro. */
export const GuardReason = {
  Empty: 'EMPTY',
  TooLong: 'TOO_LONG',
  CreditOrGrade: 'CREDIT_OR_GRADE',
  Eligibility: 'ELIGIBILITY',
  Prerequisite: 'PREREQUISITE',
  PassFail: 'PASS_FAIL',
  MetOrSatisfied: 'MET_OR_SATISFIED',
  StatusLabel: 'STATUS_LABEL',
  Readiness: 'READINESS',
  DateOrDeadline: 'DATE_OR_DEADLINE',
  EnrollmentStatus: 'ENROLLMENT_STATUS',
  Confidence: 'CONFIDENCE',
  AdvisorPromise: 'ADVISOR_PROMISE',
  Url: 'URL',
} as const;

/** A reason code from {@link GuardReason}. */
export type GuardReason = (typeof GuardReason)[keyof typeof GuardReason];

/** The guard's verdict: the original text, or the reasons it was rejected. */
export type GuardResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reasons: readonly GuardReason[] };

const MONTHS = 'january|february|march|april|june|july|august|september|october|november|december';
const MONTH_ABBR = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';

/** Content patterns in a fixed order, so reasons come out in a stable order. */
const PATTERNS: readonly (readonly [GuardReason, RegExp])[] = [
  [
    GuardReason.CreditOrGrade,
    /\bcredits?\b|\bcredit[- ]hours?\b|\bunits?\b|\bgrades?\b|\bgraded\b|\bgpa\b|\b[a-df][+-](?![\w-])|\bgrade point/i,
  ],
  [
    GuardReason.Eligibility,
    /\beligib|\bqualif(y|ies|ied|ying)\b|\ballowed\b|\bpermitted\b|\bcleared\b|\bnot able to take\b|\bcan(not|'t)? (take|enroll|sign up)/i,
  ],
  [GuardReason.Prerequisite, /\bprereq|\bpre-req|\bco-?reqs?\b|\bcorequisite/i],
  [GuardReason.PassFail, /\bpass(ed|es|ing)?\b|\bfail(ed|s|ing|ure|ures)?\b/i],
  [
    GuardReason.MetOrSatisfied,
    /\bmet\b|\bmeets?\b|\bmeeting\b|\bsatisf(y|ies|ied|ying|actory)\b|\bfulfil+(s|ed|ing|ment)?\b/i,
  ],
  [GuardReason.StatusLabel, /\bunknown\b|\bconditional(ly)?\b/i],
  [
    GuardReason.Readiness,
    /\breadiness\b|\bready\b|\bon[- ]?track\b|\bgood standing\b|\bgraduat|\bdegree[- ]complete|\bat risk\b/i,
  ],
  [
    GuardReason.DateOrDeadline,
    new RegExp(
      `\\bdeadlines?\\b|\\bdue\\b|\\blast day\\b|\\bcutoff\\b|\\b(${MONTHS})\\b|\\b(${MONTH_ABBR})\\b\\.?\\s*\\d|\\b(${WEEKDAYS})\\b|\\b\\d{1,2}[/.-]\\d{1,2}([/.-]\\d{2,4})?\\b|\\b(19|20)\\d{2}\\b|\\b\\d{1,2}(st|nd|rd|th)\\b|\\b(today|tomorrow|tonight)\\b`,
      'i',
    ),
  ],
  [
    GuardReason.EnrollmentStatus,
    /\bregist(er|ered|ers|ering|ration)\b|\benroll(ed|s|ing|ment)?\b|\bapprov(e|ed|es|al|als)\b|\bsigned up\b|\bwaitlist/i,
  ],
  [
    GuardReason.Confidence,
    /\d\s*%|\bpercent|\bconfiden|\blikely\b|\bunlikely\b|\bprobab|\bchances?\b|\bguarantee|\bcertain(ly)?\b|\bsure\b/i,
  ],
  [
    GuardReason.AdvisorPromise,
    /\b(advisor|adviser|staff|someone|counsel+or|office|team)\b[^.!?]*\b(notif|contact|reach|repl|respond|follow|review|alert|be in touch|get back)|\bnotified\b|\b(will|would|'ll) (reply|respond|contact|reach out|get back|be in touch)\b/i,
  ],
  [
    GuardReason.Url,
    /https?:|\bwww\.|\bftp:|\b[a-z0-9-]+\.(com|edu|org|net|gov|io|us|co|app|dev)\b|\]\(|<a\s/i,
  ],
];

/**
 * Decides whether the model's intro may be shown.
 *
 * Over-inclusive on purpose: a false positive costs awkward wording, a false negative lets the
 * model state an academic fact. A rejected intro is replaced with a fixed template by the caller.
 * Same input, same verdict.
 *
 * @param text - The model's intro.
 * @returns The unchanged text when accepted, otherwise the reason codes in a fixed order.
 */
export function guardIntro(text: string): GuardResult {
  const reasons: GuardReason[] = [];
  if (text.trim().length === 0) {
    reasons.push(GuardReason.Empty);
  }
  // SAFETY: an overlong intro is rejected whole; truncating could drop a "not" (ADR-0015 §3).
  if (text.length > MAX_INTRO_LENGTH) {
    reasons.push(GuardReason.TooLong);
  }
  // SAFETY: consequential academic facts come from validated fields, never model text (ADR-0015 §3, planning/10).
  for (const [reason, pattern] of PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(reason);
    }
  }
  return reasons.length === 0 ? { ok: true, text } : { ok: false, reasons };
}
