/**
 * @file Sends a success envelope after checking it against the response contract.
 * @module @caa/api/shared/send-data
 */
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';

/**
 * Validates data against its contract schema and sends it as `{ data }`.
 *
 * @param reply - Fastify reply.
 * @param schema - Response schema from @caa/api-contract.
 * @param data - Payload produced by the controller.
 * @returns The sent reply.
 * @throws {z.ZodError} When the payload breaks the contract. The error handler turns this into a 500.
 */
export function sendData<TSchema extends z.ZodType>(
  reply: FastifyReply,
  schema: TSchema,
  data: z.input<TSchema>,
): FastifyReply {
  return reply.send({ data: schema.parse(data) });
}
