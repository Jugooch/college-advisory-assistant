/**
 * @file Logger port, so services can log without Fastify types, and the app log destination.
 * @module @caa/api/shared/logger
 * @see docs/standards/09-errors-logging-and-security.md
 */

/**
 * Structured logger. Fastify's `request.log` satisfies it; services receive that per-request
 * logger through `RequestContext`, so every in-request line carries the request ID (`reqId`).
 */
export interface Logger {
  /**
   * Writes an info-level line.
   *
   * @param details - Opaque IDs and flags only. Never names, source student IDs, or tokens.
   * @param message - Short, lower-case, constant message.
   */
  info(details: Record<string, unknown>, message: string): void;

  /**
   * Writes a warn-level line, for security events a reviewer must see.
   *
   * @param details - Opaque IDs and flags only. Never names, source student IDs, or tokens.
   * @param message - Short, lower-case, constant message.
   */
  warn(details: Record<string, unknown>, message: string): void;
}

/** Where log lines go instead of stdout. Tests pass one to capture lines. */
export interface LogDestination {
  /**
   * Receives one serialized JSON log line.
   *
   * @param line - Newline-terminated JSON.
   */
  write(line: string): void;
}
