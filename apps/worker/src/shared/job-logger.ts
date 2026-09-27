/**
 * @file Structured logger that jobs receive as a dependency.
 * @module @caa/worker/shared/job-logger
 * @see docs/standards/09-errors-logging-and-security.md
 */

/**
 * Minimal structured logger. The worker passes a `pino` logger; tests pass a recording fake.
 *
 * SECURITY: fields carry opaque IDs and counts only, never student identifiers.
 */
export interface JobLogger {
  /**
   * Logs a routine event.
   *
   * @param fields - Opaque IDs and counts.
   * @param message - Short, lower-case, constant message.
   */
  info(fields: Readonly<Record<string, unknown>>, message: string): void;

  /**
   * Logs an event an operator should look at.
   *
   * @param fields - Opaque IDs and counts.
   * @param message - Short, lower-case, constant message.
   */
  warn(fields: Readonly<Record<string, unknown>>, message: string): void;
}
