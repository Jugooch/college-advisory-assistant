/**
 * @file Registers the session routes. Paths come from the shared contract.
 * @module @caa/api/modules/session/session.routes
 * @requirement FR-01
 */
import type { FastifyInstance } from 'fastify';

import { getMeEndpoint } from '@caa/api-contract';

import type { SessionController } from './session.controller';

/**
 * Registers every route in the session module. Call inside the authenticated scope.
 *
 * @param app - Authenticated Fastify scope.
 * @param controller - Session controller.
 */
export function registerSessionRoutes(app: FastifyInstance, controller: SessionController): void {
  app.route({ method: getMeEndpoint.method, url: getMeEndpoint.path, handler: controller.getMe });
}
