/**
 * @file Fixed headings and next steps for every API error code. The API's own message is shown
 * beside them, unchanged.
 * @module @caa/web/shared/utils/error-code-wording
 * @requirement NFR-02
 * @see docs/planning/05-product-requirements.md
 * @see docs/standards/05-api-design.md
 */
import type { ErrorCode } from '@caa/domain';

/** Plain-language wording for one error code. */
export interface ErrorWording {
  /** Short heading naming what happened. */
  readonly heading: string;
  /** What the student can do next, including a human route. */
  readonly nextStep: string;
}

const CONTACT_ADVISOR = 'contact your advisor if you need help now.';

/** Wording for every {@link ErrorCode}. The type requires an entry for each code. */
export const ERROR_CODE_WORDING: Readonly<Record<ErrorCode, ErrorWording>> = {
  INVALID_REQUEST: {
    heading: 'This request couldn’t be read',
    nextStep: 'Check the link or your selection and try again.',
  },
  UNAUTHORIZED: {
    heading: 'You are not signed in',
    nextStep: 'Sign in, then open this page again.',
  },
  NOT_FOUND: {
    heading: 'Record not found',
    nextStep: 'Check the link. If you think you should see this record, contact your advisor.',
  },
  OUT_OF_SCOPE: {
    heading: 'Your program isn’t supported here yet',
    nextStep:
      'Personalized checks aren’t available for this program or catalog. This doesn’t mean your record is wrong; your advisor can help you plan.',
  },
  SOURCE_UNAVAILABLE: {
    heading: 'A source system is unavailable',
    nextStep: `Nothing was changed. Try again later, or ${CONTACT_ADVISOR}`,
  },
  STALE_SOURCE: {
    heading: 'Your record is being refreshed',
    nextStep: `Results aren’t shown until the record is current. Try again later, or ${CONTACT_ADVISOR}`,
  },
  SEMANTIC_GAP: {
    heading: 'This can’t be checked automatically',
    nextStep: 'Your advisor can review it with you.',
  },
  REVISION_CONFLICT: {
    heading: 'This changed since you opened it',
    nextStep: 'Reload the page to see the latest version.',
  },
  SEARCH_TIMEOUT: {
    heading: 'The search didn’t finish',
    nextStep: `An unfinished search proves nothing either way. Try again, or ${CONTACT_ADVISOR}`,
  },
  NO_FEASIBLE_PLAN: {
    heading: 'No valid option was found',
    nextStep: 'Ask your advisor which of your preferences could change.',
  },
  INTERNAL_ERROR: {
    heading: 'Something went wrong',
    nextStep: `Nothing was changed. Try again later, or ${CONTACT_ADVISOR}`,
  },
};

/**
 * Looks up the fixed wording for an error code.
 *
 * @param code - Error code from an API error envelope.
 * @returns Its heading and next step.
 */
export function describeError(code: ErrorCode): ErrorWording {
  return ERROR_CODE_WORDING[code];
}
