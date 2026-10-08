/**
 * @file Deterministic detectors on the student's message that trigger fixed responses.
 * @module @caa/assistant/guards/message
 * @requirement FR-10
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { SpecialistTopic } from '@caa/domain';

/** How strongly a message signals crisis. Tier 1 wins when both tiers match. */
export const CrisisTier = {
  None: 'NONE',
  Ambiguous: 'AMBIGUOUS',
  Unambiguous: 'UNAMBIGUOUS',
} as const;

/** Union of every {@link CrisisTier} value. */
export type CrisisTier = (typeof CrisisTier)[keyof typeof CrisisTier];

/** What the student's message matched. An UNAMBIGUOUS crisis means the model must not be called. */
export interface FixedResponseMatches {
  /** Non-crisis topics in a fixed order. */
  readonly specialistTopics: readonly SpecialistTopic[];
  /** Crisis tier. UNAMBIGUOUS means the model must not be called; AMBIGUOUS shows support resources. */
  readonly crisis: CrisisTier;
  /** A what-if about grades or outcomes. */
  readonly hypothetical: boolean;
  /** A request to skip or waive a requirement. */
  readonly override: boolean;
  /** A claim that a recorded grade is wrong. */
  readonly gradeDispute: boolean;
}

const TOPIC_PATTERNS: readonly (readonly [SpecialistTopic, RegExp])[] = [
  [
    SpecialistTopic.FinancialAid,
    /financial aid|\bfafsa\b|scholarship|\bpell\b|\bloans?\b|work[- ]study|\bbursar\b|tuition (waiver|assistance)|satisfactory academic progress/,
  ],
  [
    SpecialistTopic.Immigration,
    /\bvisa\b|\bf-?1\b|\bi-?20\b|immigration|\bsevis\b|international student|practical training|work authorization/,
  ],
  [
    SpecialistTopic.Athletics,
    /\bncaa\b|\bnaia\b|athletic|athlete|\bvarsity\b|my (sport|team|coach)/,
  ],
  [
    SpecialistTopic.Accessibility,
    /disabilit|accommodation|accessib|\bada\b|\b504\b|extended time|learning difference/,
  ],
  [SpecialistTopic.Appeals, /\bappeal|\bgrievance|\breinstat|\bpetition/],
];

// SAFETY: tier 1 is first-person self-harm or suicide phrases only (ADR-0015 Amendment 1). It skips the model and shows the crisis referral.
const TIER1_PATTERN = new RegExp(
  [
    '\\bkill(ing|ed)? my ?self\\b',
    '\\bsuicidal\\b',
    '\\bend(ing)? my (own )?life\\b',
    '\\b(take|taking|took) my (own )?life\\b',
    '\\b(want to|wanna) (die|be dead)\\b',
    '\\bwish i (was|were) dead\\b',
    '\\bbetter off dead\\b',
    '\\bhurt(ing)? my ?self\\b',
    '\\bk\\.? ?m\\.? ?s\\b',
  ].join('|'),
);

// SAFETY: tier 2 is over-inclusive on purpose (ADR-0015 §5): a false positive shows support resources, a false negative is unacceptable. It never skips the model on its own.
const TIER2_PATTERN = new RegExp(
  [
    'suicid',
    '\\bkill(ing|s)? (me|my ?self)\\b',
    '\\bkys\\b',
    '\\bend(ing)? (my life|my own life|it all|it)\\b',
    '\\b(take|taking|took) (my|my own) (own )?life\\b',
    '\\bnot wake up\\b',
    '\\b(want|wanna|wish|wished|going|planning|plan|ready|trying|thinking of|thinking about)( to| i was| i were)? ?(be )?(die|dying|dead|disappear|vanish)',
    '\\bwant to (die|disappear|vanish|be dead|not exist)',
    'better off (dead|without me)',
    '\\bno point\\b',
    '\\bno (reason|purpose) (in |to )?(living|live|going on|go on|being alive|continuing|existing|life)',
    "\\bcan'?t go on\\b",
    '\\bwant (it|this|everything) to (stop|end|be over)',
    "\\bcan'?t (keep going|do this anymore|take it anymore|take this anymore|take it any ?more)\\b",
    '\\bgive up\\b|\\bgiving up\\b|\\bhopeless',
    'self[- ]?(harm|injur|mutilat)',
    '\\b(hurt|hurting|harm|harming|cut|cutting|injure|injuring|burn|burning) (myself|my ?self)\\b',
    "(don'?t|do not|doesn'?t|no longer) want to (live|be alive|be here|exist|wake)",
    '\\bno reason to (live|go on|be alive)\\b',
    'overdos',
    '\\b(die|dies|dying|dead|death|unalive|unaliv\\w*)\\b',
    '\\bend(ing)? (things|everything|the pain|my pain|my suffering|the suffering)\\b',
    '\\b(nobody|no one|no-one) (would|will) (miss|care|notice)',
    '\\bburden\\b',
    '\\bnot worth (living|it|going on|being alive)\\b',
    "\\bisn'?t worth (living|it)\\b",
    '\\bworth living\\b',
    "out of this life|\\bsomething drastic\\b|\\bwon'?t be around\\b|\\bsleep forever\\b|\\bdone with (life|everything|living)\\b|\\bhate being alive\\b",
    '\\b(better|rather) (off )?without me\\b|\\bbetter without me\\b',
    '\\b(jump|jumping) (off|from)\\b|\\b(shoot|shooting|hang|hanging|drown|drowning|poison|poisoning|stab|stabbing) (myself|my ?self)\\b',
    "\\bcan'?t (take|handle|stand|bear) (it|this|life)\\b",
    "\\bdon'?t (wanna|want to|wish to) (live|be alive|be here|exist)|\\bdo not wish to (live|be alive)",
    '\\bthinking (about|of) (ending|death|dying)',
    'being abused|abusing me|\\babused\\b',
    'in danger|not safe|unsafe|emergency|\\b911\\b',
  ].join('|'),
);

const HYPOTHETICAL_PATTERN =
  /assum(e|ing) (that )?i|what if i|if i (pass|passed|fail|failed|get|got|finish|complete|retake|drop|withdraw|took|take|had)|suppose i|pretend i|let'?s say i|imagine i|hypothetical/;

const OVERRIDE_PATTERN =
  /ignor(e|ing) (the |that |this |my )?(pre-?req|co-?req|requirement)|skip(ping)? (the |that )?(pre-?req|co-?req)|\boverrid|\bbypass|\bwaiv(e|er|ers|ed)\b|get(ting)? around (the |that )?(pre-?req|requirement)|without (the |taking )?(pre-?req)|make an exception|exception to (the )?(pre-?req|rule|requirement)/;

const GRADE_DISPUTE_PATTERN =
  /grade[^.!?]{0,30}(wrong|incorrect|missing|mistake|error|not right|isn'?t right|doesn'?t look right|doesn'?t match|off)|(wrong|incorrect|missing|bad|erroneous) grade|grade (dispute|error|discrepancy)|dispute (my|the|a) grade|should (have|'ve) (gotten|got|received|earned) an? [a-f]\b|transcript[^.!?]{0,30}(wrong|incorrect|mistake|error)/;

/**
 * NFKC-normalizes, drops invisible characters, lowercases, straightens curly apostrophes and collapses whitespace so keyword lists stay simple.
 *
 * @param message - The raw message.
 * @returns The normalized text.
 */
function normalize(message: string): string {
  return message
    .normalize('NFKC')
    .replace(/[\p{Cf}\u00AD]/gu, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u2032\u00B4\u0060]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Classifies how strongly a normalized message signals crisis; tier 1 wins when both tiers match.
 *
 * @param text - The normalized message.
 * @returns The crisis tier.
 */
function crisisTier(text: string): CrisisTier {
  if (TIER1_PATTERN.test(text)) {
    return CrisisTier.Unambiguous;
  }
  return TIER2_PATTERN.test(text) ? CrisisTier.Ambiguous : CrisisTier.None;
}

/**
 * Finds the fixed responses a student's message calls for.
 *
 * Tier 2 is over-inclusive on purpose (ADR-0015 §5, Amendment 1). Case-insensitive; same message, same matches.
 *
 * @param message - The student's raw message.
 * @returns The matched topics and flags.
 */
export function detectFixedResponses(message: string): FixedResponseMatches {
  const text = normalize(message);
  return {
    specialistTopics: TOPIC_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(
      ([topic]) => topic,
    ),
    crisis: crisisTier(text),
    hypothetical: HYPOTHETICAL_PATTERN.test(text),
    override: OVERRIDE_PATTERN.test(text),
    gradeDispute: GRADE_DISPUTE_PATTERN.test(text),
  };
}
