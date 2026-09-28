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

/** The source hasn't supplied the record this read needs, so there is nothing to show. */
export class SourceUnavailableError extends DomainError {
  /** Creates a SOURCE_UNAVAILABLE error that refers the student to an advisor. */
  constructor() {
    super(
      ErrorCode.SourceUnavailable,
      'Your academic record is not available yet. Please contact your advisor.',
    );
    this.name = 'SourceUnavailableError';
  }
}

/** The source's latest revisions conflict, so no revision can be shown as the current one. */
export class StaleSourceError extends DomainError {
  /** Creates a STALE_SOURCE error that refers the student to an advisor. */
  constructor() {
    super(
      ErrorCode.StaleSource,
      'Your academic record needs to be verified. Please contact your advisor.',
    );
    this.name = 'StaleSourceError';
  }
}

/** The request can't be checked as sent. The message names no field, value, or internal. */
export class InvalidRequestError extends DomainError {
  /** Creates an INVALID_REQUEST error with the standard message. */
  constructor() {
    super(ErrorCode.InvalidRequest, 'The request was invalid');
    this.name = 'InvalidRequestError';
  }
}
