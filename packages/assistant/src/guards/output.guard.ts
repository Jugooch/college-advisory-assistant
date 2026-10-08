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
  Digit: 'DIGIT',
  NonAscii: 'NON_ASCII',
  AcademicAction: 'ACADEMIC_ACTION',
} as const;

/** A reason code from {@link GuardReason}. */
export type GuardReason = (typeof GuardReason)[keyof typeof GuardReason];

/** The guard's verdict: the original text, or the reasons it was rejected. */
export type GuardResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reasons: readonly GuardReason[] };

const INVISIBLE = /[\p{Cf}\u00AD]/gu;
const DASHES = /[\u2010-\u2015\u2212]/g;
const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u02BC\u2032\u00B4\u0060]/g;
const DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F\u2033]/g;

/**
 * Builds the copy of the text the patterns run on: NFKC, invisible characters removed, curly
 * quotes and dashes folded to ASCII, whitespace collapsed. The original text is never altered.
 *
 * @param text - The model's intro.
 * @returns The normalized copy.
 */
function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ');
}

const MONTHS = 'january|february|march|april|june|july|august|september|october|november|december';
const MONTH_ABBR = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';

/** Content patterns in a fixed order, so reasons come out in a stable order. */
const PATTERNS: readonly (readonly [GuardReason, RegExp])[] = [
  [
    GuardReason.CreditOrGrade,
    /\bcredits?\b|\bcredit[- ]hours?\b|\bunits?\b|\bgrades?\b|\bgraded\b|\bgpa\b|\b[a-df][+-](?![\w-])|\bgrade point|\b(hours?|semester hours|quarter hours)\b|\b(an?|got|get|earned?|received?|made|scored?|with|have|had|at)\s+(an?\s+)?[a-fp]\b(?![\w'-])|\bmarks?\b|\baverage\b|\bscor(e|ed|es|ing)\b|\bresults?\b|\btranscript\b|\bload\b|\bworth\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|eighteen|twenty)\b/i,
  ],
  [
    GuardReason.CreditOrGrade,
    // SAFETY: a standalone capital grade token is rejected even with no grade verb nearby.
    /\b[A-DFP]\b(?![\w'-])/,
  ],
  [
    GuardReason.Eligibility,
    /\beligib|\bqualif(y|ies|ied|ying)\b|\ballowed\b|\bpermitted\b|\bcleared\b|\bnot able to take\b|\bcan(not|'t)? (take|enroll|sign up)|\byours\b|\b(works?|fine|good|okay|ok|open|available|possible|suitable|safe) for you\b|\bon the table\b|\bno problem\b|\bhave the background\b|\bstands? in your way\b|\bclears? the bar\b|\bcovered\b|\bgo ahead\b|\bfree to\b/i,
  ],
  [GuardReason.Prerequisite, /\bprereq|\bpre-req|\bco-?reqs?\b|\bcorequisite/i],
  [GuardReason.PassFail, /\bpass(ed|es|ing)?\b|\bfail(ed|s|ing|ure|ures)?\b/i],
  [
    GuardReason.MetOrSatisfied,
    /\bmet\b|\bmeets?\b|\bmeeting\b|\bsatisf(y|ies|ied|ying|actory)\b|\bfulfil+(s|ed|ing|ment)?\b|\benough\b|\bshort\b|\bmissing\b|\bnothing (is|to) (missing|wrong|needed)\b|\ball (clear|good)\b|\bin place\b|\bworks? out\b|\bsorted\b|\bhandled\b|\bresolved\b|\bno issues?\b|\blooks? (good|fine|great|ok|okay)\b|\bnothing to worry\b|\beverything (is|looks|needed)\b/i,
  ],
  [GuardReason.StatusLabel, /\bunknown\b|\bconditional(ly)?\b/i],
  [
    GuardReason.Readiness,
    /\breadiness\b|\bready\b|\bon[- ]?track\b|\bgood standing\b|\bgraduat|\bdegree[- ]complete|\bat risk\b|\bcomplet(e|ed|es|ing|ion)\b|\bdone\b|\bfinish(ed|es|ing)?\b|\ball set\b|\bgood to go\b|\b(good|fine|great|well|excellent|strong|solid|nearly|almost|aced|worry)\b|\bset for\b|\bstanding\b|\bin shape\b/i,
  ],
  [
    GuardReason.DateOrDeadline,
    new RegExp(
      `\\bdeadlines?\\b|\\bdue\\b|\\blast day\\b|\\bcutoff\\b|\\b(${MONTHS})\\b|\\b(${MONTH_ABBR})\\b\\.?\\s*\\d|\\b(${WEEKDAYS})\\b|\\b\\d{1,2}[/.-]\\d{1,2}([/.-]\\d{2,4})?\\b|\\b(19|20)\\d{2}\\b|\\b\\d{1,2}(st|nd|rd|th)\\b|\\b(today|tomorrow|tonight|soon|yesterday)\\b|\\b(next|this|last|coming|end of|start of|beginning of)\\s+(week|weekend|month|term|semester|quarter|year|fall|spring|summer|winter)\\b|\\bin\\s+(\\d+|a|an|one|two|three|four|five|six|seven|ten|few|couple)\\s+(days?|weeks?|months?|hours?|minutes?)\\b|\\b(close[sd]?|open(s|ed)?|ends?|ended|expires?|expired|begins?|starts?|starting)\\b|\\b(in|by|until|before|after|since|early|mid|late|end of)\\s+may\\b`,
      'i',
    ),
  ],
  [
    GuardReason.EnrollmentStatus,
    /\bregist(er|ered|ers|ering|ration)\b|\benroll(ed|s|ing|ment)?\b|\bapprov(e|ed|es|al|als)\b|\bsigned up\b|\bwaitlist|\bbook(ed|ing|s)?\b|\breserv(e|ed|es|ation|ations)\b|\blocked in\b|\bsecur(e|ed|es|ing)\b|\b(your|a|the) (seat|spot)\b|\badd(ed)? to (your )?schedule\b|\btime\b|\blate\b|\bquick(ly)?\b|\bhurry\b|\bwindow\b|\bperiod\b|\bshuts?\b|\bright away\b|\bat once\b|\bopening\b|\bimmediate(ly)?\b|\bgone\b|\brunning out\b|\bfall\b|\bspring\b|\bwinter\b|\bsummer\b|\bis over\b|\b(locked|submitted|processed|filed|forwarded|went through|goes through|handled)\b|\bon your schedule\b|\b(hold|holds|held) a (place|seat|spot)\b|\bhas you\b|\b(went|goes|gone) in\b|\bpart of your plan\b|\bsystem\b|\bsigned in\b|\b(courses|classes) are in\b|\bplan is (set|good|saved|locked|done)\b|\b(was|were|has been|have been) (made|sent|placed|passed along)\b/i,
  ],
  [
    GuardReason.Confidence,
    /\d\s*%|\bpercent|\bconfiden|\blikely\b|\bunlikely\b|\bprobab|\bchances?\b|\bguarantee|\bcertain(ly)?\b|\bsure\b/i,
  ],
  [
    GuardReason.AdvisorPromise,
    /\b(advisor|adviser|staff|someone|counsel+or|office|team)\b[^.!?]*\b(notif|contact|reach|repl|respond|follow|review|alert|be in touch|get back|know|aware|look|check|handl|with|expect|email\w*|deliver\w*|sees|saw|received|got it|has the)|\bnotified\b|\b(email|emailed|delivered|message[sd]?)\b|\bwith (the|our|an?) (team|office|staff|advisor|adviser)\b|\b(will|would|'ll) (reply|respond|contact|reach out|get back|be in touch)\b|\bwill\b|\bwon't\b|\bwould\b|\bshall\b|\bwe\b|\blook(s|ing)? into\b|\bfollow(ing)? up\b|\bin contact\b|\bin touch\b|\bhear from\b|\bcall\b|\bon the way\b|\bexpect\b|\bhelp is\b|\bhas been sent\b|\baware\b|\bpassed along\b/i,
  ],
  [
    // SAFETY: the action verbs themselves are rejected whatever modal or negation surrounds them (ADR-0015 §3).
    GuardReason.AcademicAction,
    /\b(take|takes|took|taken|taking|enrol+\w*|regist\w*|sign(s|ed|ing)? ?up|signup|add(s|ed|ing)?|drop(s|ped|ping)?|withdr(aw|aws|awn|ew|awing|awal|awals)|qualif\w*|eligib\w*|allow\w*|permit\w*|able|unable|ability|enabl\w*|cleared|join(s|ed|ing)?|get(s|ting)? (in|into)|got (in|into)|pick(s|ed|ing)?|choos\w*|chose|chosen|you'?re in|you are in|final|finali[sz]\w*|official\w*|confirmed|must|need(s|ed)? to|have to|has to|required?|requires|requirements?|stops?|stopped|blocks?|blocked|prevents?|prevented|free to|(ok|okay|good|fine|safe) to|cannot|can'?t|can|could|may|might|should|shall|will be able|courses?|class(es)?|sections?|roster|degree|majors?|minors?|seniors?|juniors?|sophomores?|freshm[ae]n|semesters?|access|belong\w*|available|yes|excel\w*|behind you|go for|a match|supports?|history)\b/i,
  ],
  [
    // SAFETY: the fallback templates need no digit, so any digit (hours, dates, counts) is rejected.
    GuardReason.Digit,
    /\d/,
  ],
  [
    // SAFETY: capitalized May is a month; lowercase may after a preposition is handled above.
    GuardReason.DateOrDeadline,
    /\bMay\b/,
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
  const add = (reason: GuardReason): void => {
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  };
  if (text.trim().length === 0) {
    add(GuardReason.Empty);
  }
  // SAFETY: an overlong intro is rejected whole; truncating could drop a "not" (ADR-0015 §3).
  if (text.length > MAX_INTRO_LENGTH) {
    add(GuardReason.TooLong);
  }
  // Bounded work on untrusted text: only the first MAX_INTRO_LENGTH + 1 characters are matched.
  const normalized = normalizeForMatching(text.slice(0, MAX_INTRO_LENGTH + 1));
  // SAFETY: homoglyphs, invisible and exotic characters are rejected rather than interpreted.
  if (/[^\x20-\x7E]/.test(normalized)) {
    add(GuardReason.NonAscii);
  }
  // SAFETY: consequential academic facts come from validated fields, never model text (ADR-0015 §3, planning/10).
  for (const [reason, pattern] of PATTERNS) {
    if (pattern.test(normalized)) {
      add(reason);
    }
  }
  return reasons.length === 0 ? { ok: true, text } : { ok: false, reasons };
}
