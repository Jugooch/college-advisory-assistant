/**
 * @file Typed errors that services and controllers throw; the error handler maps each code to a status.
 * @module @caa/api/shared/domain-errors
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { ErrorCode } from '@caa/domain';

/** Base class for expected failures. `message` is always safe to show to a student. */
export class DomainError extends Error {
  /** Code sent in the error envelope. */
  readonly code: ErrorCode;

  /**
   * Creates a typed error.
   *
   * @param code - Envelope error code.
   * @param message - Client-safe message with no identifiers or internals.
   */
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

/** The object doesn't exist or the actor may not see it. The two cases are deliberately identical. */
export class NotFoundError extends DomainError {
  /** Creates a NOT_FOUND error with the standard message. */
  constructor() {
    super(ErrorCode.NotFound, 'The requested resource was not found');
    this.name = 'NotFoundError';
  }
}

/** The request has no valid session. */
export class UnauthorizedError extends DomainError {
  /** Creates an UNAUTHORIZED error with the standard message. */
  constructor() {
    super(ErrorCode.Unauthorized, 'Sign in to continue');
    this.name = 'UnauthorizedError';
  }
}
