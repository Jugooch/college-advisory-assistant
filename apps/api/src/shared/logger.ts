/**
 * @file Minimal structured logger port, so services can log without depending on Fastify.
 * @module @caa/api/shared/logger
 * @see docs/standards/09-errors-logging-and-security.md
 */

/** Structured logger. The Fastify (pino) logger satisfies it. */
export interface Logger {
  /**
   * Writes an info-level line.
   *
   * @param details - Opaque IDs and flags only. Never names, source student IDs, or tokens.
   * @param message - Short, lower-case, constant message.
   */
  info(details: Record<string, unknown>, message: string): void;
}
