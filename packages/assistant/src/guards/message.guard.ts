/**
 * @file Deterministic detectors on the student's message that trigger fixed responses.
 * @module @caa/assistant/guards/message
 * @requirement FR-10
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { SpecialistTopic } from '@caa/domain';

/** What the student's message matched. Crisis means the model must not be called. */
export interface FixedResponseMatches {
  /** Non-crisis topics in a fixed order. */
  readonly specialistTopics: readonly SpecialistTopic[];
  readonly crisis: boolean;
  readonly hypothetical: boolean;
  readonly override: boolean;
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

const CRISIS_PATTERN =
  /suicid|kill (myself|me)|end (my|it all|my life)|want to die|wanna die|better off dead|self[- ]?harm|hurt(ing)? myself|harm(ing)? myself|cut(ting)? myself|(don'?t|do not|doesn'?t) want to (live|be alive|be here)|no reason to live|can'?t go on|overdose|being abused|abusing me|in danger|not safe|unsafe|emergency|\b911\b/;

const HYPOTHETICAL_PATTERN =
  /assum(e|ing) (that )?i|what if i|if i (pass|passed|fail|failed|get|got|finish|complete|retake|drop|withdraw|took|take|had)|suppose i|pretend i|let'?s say i|imagine i|hypothetical/;

const OVERRIDE_PATTERN =
  /ignor(e|ing) (the |that |this |my )?(pre-?req|co-?req|requirement)|skip(ping)? (the |that )?(pre-?req|co-?req)|\boverrid|\bbypass|\bwaiv(e|er|ers|ed)\b|get(ting)? around (the |that )?(pre-?req|requirement)|without (the |taking )?(pre-?req)|make an exception|exception to (the )?(pre-?req|rule|requirement)/;

const GRADE_DISPUTE_PATTERN =
  /grade[^.!?]{0,30}(wrong|incorrect|missing|mistake|error|not right|isn'?t right|doesn'?t look right|doesn'?t match|off)|(wrong|incorrect|missing|bad|erroneous) grade|grade (dispute|error|discrepancy)|dispute (my|the|a) grade|should (have|'ve) (gotten|got|received|earned) an? [a-f]\b|transcript[^.!?]{0,30}(wrong|incorrect|mistake|error)/;

/**
 * Lowercases, straightens curly apostrophes and collapses whitespace so keyword lists stay simple.
 *
 * @param message - The raw message.
 * @returns The normalized text.
 */
function normalize(message: string): string {
  return message.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ');
}

/**
 * Finds the fixed responses a student's message calls for.
 *
 * Over-inclusive on purpose (ADR-0015 §5). Case-insensitive; same message, same matches.
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
    // SAFETY: crisis language must skip the model entirely and show the fixed referral (ADR-0015 §5).
    crisis: CRISIS_PATTERN.test(text),
    hypothetical: HYPOTHETICAL_PATTERN.test(text),
    override: OVERRIDE_PATTERN.test(text),
    gradeDispute: GRADE_DISPUTE_PATTERN.test(text),
  };
}
