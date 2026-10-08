/**
 * @file Registers the policy search route. Paths come from the shared contract.
 * @module @caa/api/modules/policy-search/policy-search.routes
 * @requirement FR-16
 */
import type { FastifyInstance } from 'fastify';

import { searchPoliciesEndpoint } from '@caa/api-contract';

import type { PolicySearchController } from './policy-search.controller';

/**
 * Registers the policy search route. Call inside the authenticated scope. It only reads.
 *
 * @param app - Authenticated Fastify scope.
 * @param controller - Policy search controller.
 */
export function registerPolicySearchRoutes(
  app: FastifyInstance,
  controller: PolicySearchController,
): void {
  app.route({
    method: searchPoliciesEndpoint.method,
    url: searchPoliciesEndpoint.path,
    handler: controller.searchPolicies,
  });
}
