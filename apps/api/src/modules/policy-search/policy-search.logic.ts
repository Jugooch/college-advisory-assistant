/**
 * @file Deterministic keyword search over approved policy documents: tokenize, score, rank,
 * excerpt and conflict marking. Pure functions; no embeddings, no clock, no I/O.
 * @module @caa/api/modules/policy-search/policy-search.logic
 * @requirement FR-16
 * @requirement AC42
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 6)
 */
import type { PolicyDocument, PolicyTopic } from '@caa/domain';

/** Most hits a search returns. */
export const MAX_HITS = 3;

/** Longest excerpt, in characters. */
export const MAX_EXCERPT_LENGTH = 500;

/** Words that carry no meaning for matching; fixed so results are reproducible. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'or',
  'the',
  'to',
  'was',
  'what',
  'when',
  'with',
]);

/** What a search asks for. At least one field is set (the contract enforces it). */
export interface PolicySearchCriteria {
  readonly q?: string | undefined;
  readonly topic?: PolicyTopic | undefined;
}

/** One document that matched, with the paragraph that matched best. */
export interface PolicyMatch {
  readonly document: PolicyDocument;
  readonly score: number;
  readonly excerpt: string;
  /** True when another match shares this document's subject, so the two may disagree. */
  readonly conflict: boolean;
}

/**
 * Splits text into lower-case tokens on anything that is not a letter or digit, dropping stop
 * words.
 *
 * @param text - Query or document text.
 * @returns The tokens, in order, with repeats.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== '' && !STOP_WORDS.has(token));
}

/**
 * Orders two keys by code unit, so the order never depends on locale data.
 *
 * @param left - First key.
 * @param right - Second key.
 * @returns Negative, zero or positive.
 */
function compareKeys(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * Counts how many distinct query tokens appear in the text.
 *
 * @param queryTokens - Distinct query tokens.
 * @param text - Text to look in.
 * @returns The number of distinct query tokens present.
 */
function countDistinctHits(queryTokens: readonly string[], text: string): number {
  const present = new Set(tokenize(text));
  return queryTokens.filter((token) => present.has(token)).length;
}

/**
 * Scores a document: distinct query tokens in the title count twice, in the body once.
 *
 * @param queryTokens - Distinct query tokens.
 * @param document - The document.
 * @returns The score; 0 means no match.
 */
export function scoreDocument(queryTokens: readonly string[], document: PolicyDocument): number {
  return (
    2 * countDistinctHits(queryTokens, document.title) +
    countDistinctHits(queryTokens, document.body)
  );
}

/**
 * Cuts text to at most the limit, at a word boundary where there is one.
 *
 * @param text - Trimmed, non-empty text.
 * @param limit - Most characters to keep.
 * @returns The text, or its longest whole-word prefix.
 */
function cutAtWordBoundary(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const head = text.slice(0, limit);
  // A space right after the head means the head ends on a whole word.
  const isOnWordEnd = /\s/u.test(text.charAt(limit));
  const boundary = isOnWordEnd ? head.length : head.search(/\s\S*$/u);
  return (boundary > 0 ? head.slice(0, boundary) : head).trim();
}

/**
 * Picks the paragraph with the most distinct query tokens (the first on a tie) and cuts it to
 * the excerpt limit. With no query tokens the first paragraph is used.
 *
 * @param queryTokens - Distinct query tokens.
 * @param body - Document body.
 * @returns The excerpt; never empty for a non-blank body.
 */
export function excerptOf(queryTokens: readonly string[], body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
  let best = paragraphs[0] ?? body.trim();
  let bestHits = countDistinctHits(queryTokens, best);
  for (const paragraph of paragraphs) {
    const hits = countDistinctHits(queryTokens, paragraph);
    if (hits > bestHits) {
      best = paragraph;
      bestHits = hits;
    }
  }
  return cutAtWordBoundary(best, MAX_EXCERPT_LENGTH);
}

/**
 * Marks matches whose subject another match shares.
 *
 * @param documents - The matched documents.
 * @returns The subject keys that more than one match carries.
 */
function conflictingSubjects(documents: readonly PolicyDocument[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { subjectKey } of documents) {
    if (seen.has(subjectKey)) {
      repeated.add(subjectKey);
    }
    seen.add(subjectKey);
  }
  return repeated;
}

/**
 * Searches the given applicable documents. A text query keeps documents with a score above 0
 * (ranked by score, then `documentKey`); a topic keeps only that topic; a topic alone lists the
 * topic's documents by `documentKey`. At most {@link MAX_HITS} are returned.
 *
 * @param documents - Documents already filtered for tenant, audience, approval and dates.
 * @param criteria - The query text and optional topic.
 * @returns The ranked matches. Identical input gives identical output.
 */
export function searchPolicies(
  documents: readonly PolicyDocument[],
  criteria: PolicySearchCriteria,
): readonly PolicyMatch[] {
  const queryTokens = [...new Set(tokenize(criteria.q ?? ''))];
  const isListing = criteria.q === undefined;
  const scored = documents
    .filter((document) => criteria.topic === undefined || document.topic === criteria.topic)
    .map((document) => ({ document, score: scoreDocument(queryTokens, document) }))
    .filter(({ score }) => isListing || score > 0)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        compareKeys(left.document.documentKey, right.document.documentKey),
    )
    .slice(0, MAX_HITS);
  const conflicts = conflictingSubjects(scored.map(({ document }) => document));
  return scored.map(({ document, score }) => ({
    document,
    score,
    excerpt: excerptOf(queryTokens, document.body),
    conflict: conflicts.has(document.subjectKey),
  }));
}
