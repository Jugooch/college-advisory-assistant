/**
 * @file HTTP handlers for the session module.
 * @module @caa/api/modules/session/session.controller
 * @requirement FR-01
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

import { MeResponseSchema } from '@caa/api-contract';

import { requireActor } from '../../plugins/auth.plugin';
import { sendData } from '../../shared/send-data';

/** Handlers for the session routes. Declared as properties so they can be passed to routes unbound. */
export interface SessionController {
  readonly getMe: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the session controller.
 *
 * @returns A {@link SessionController}.
 */
export function createSessionController(): SessionController {
  return {
    getMe: async (request, reply) => sendData(reply, MeResponseSchema, requireActor(request)),
  };
}
