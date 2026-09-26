/**
 * @file HTTP handlers for the health module. Translates between HTTP and the service.
 * @module @caa/api/modules/health/health.controller
 */
import { HealthResponseSchema } from '@caa/api-contract';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { sendData } from '../../shared/send-data';
import type { HealthService } from './health.service';

/** Handlers for the health routes. Declared as properties so they can be passed to routes unbound. */
export interface HealthController {
  readonly getHealth: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the health controller.
 *
 * @param service - Health service.
 * @returns A {@link HealthController}.
 */
export function createHealthController(service: HealthService): HealthController {
  return {
    async getHealth(_request, reply) {
      const snapshot = service.getSnapshot();
      return sendData(reply, HealthResponseSchema, { status: 'ok', ...snapshot });
    },
  };
}
