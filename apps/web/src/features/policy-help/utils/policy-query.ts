/**
 * @file Reads the policy search text from the page's query.
 * @module @caa/web/features/policy-help/utils/policy-query
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { PolicySearchQuerySchema } from '@caa/api-contract';

/** The query parameter and form field that carry the search text. */
export const POLICY_QUERY_FIELD = 'q';

/** What the page was asked to search for. */
export type PolicyQuery =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly text: string };

/**
 * Reads the search text.
 *
 * @param value - The raw `q` query value.
 * @returns `none` when missing or blank, `invalid` when repeated or longer than the API allows,
 *   otherwise the trimmed text.
 */
export function readPolicyQuery(value: string | readonly string[] | undefined): PolicyQuery {
  if (value === undefined) {
    return { kind: 'none' };
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid' };
  }
  if (value.trim() === '') {
    return { kind: 'none' };
  }
  const parsed = PolicySearchQuerySchema.safeParse({ q: value });
  return parsed.success && parsed.data.q !== undefined
    ? { kind: 'valid', text: parsed.data.q }
    : { kind: 'invalid' };
}
