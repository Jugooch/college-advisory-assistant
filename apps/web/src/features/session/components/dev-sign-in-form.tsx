/**
 * @file The development sign-in form. Rendered only by builds that offer dev sign-in.
 * @module @caa/web/features/session/components/dev-sign-in-form
 * @requirement FR-01
 */
import type { ReactElement } from 'react';

/** Props for {@link DevSignInForm}. */
export interface DevSignInFormProps {
  /** Server action that stores the submitted token in the session cookie. */
  readonly signInAction: (formData: FormData) => Promise<void>;
  /** Server action that removes the session cookie. */
  readonly signOutAction: () => Promise<void>;
  /** Whether the last submitted token was malformed. */
  readonly hasInvalidToken: boolean;
}

/**
 * Renders the token form and a sign-out button.
 *
 * @param props - The two actions and the error flag.
 * @returns The sign-in section.
 */
export function DevSignInForm({
  signInAction,
  signOutAction,
  hasInvalidToken,
}: DevSignInFormProps): ReactElement {
  const describedBy = hasInvalidToken ? 'dev-token-hint dev-token-error' : 'dev-token-hint';
  return (
    <>
      <h1>Development sign-in</h1>
      <p>
        For local development with synthetic identities only. Production builds don’t offer this
        page. The API decides whether the token signs anyone in.
      </p>
      <form action={signInAction}>
        <label htmlFor="dev-token">Dev token</label>
        <input
          id="dev-token"
          name="token"
          type="password"
          required
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={hasInvalidToken}
        />
        <p id="dev-token-hint">
          A token from <code>DEV_AUTH_TOKENS</code> in <code>infra/env.example</code>, for example{' '}
          <code>dev-token-student</code>.
        </p>
        {hasInvalidToken ? (
          <p id="dev-token-error" className="field-error" role="alert">
            Enter a token with no spaces.
          </p>
        ) : null}
        <button type="submit">Sign in</button>
      </form>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
