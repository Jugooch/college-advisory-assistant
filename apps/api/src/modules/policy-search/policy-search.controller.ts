/**
 * @file HTTP handler for approved policy search.
 * @module @caa/api/modules/policy-search/policy-search.controller
 * @requirement FR-16
 * @requirement NFR-02
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

import { PolicySearchQuerySchema, PolicySearchResponseSchema } from '@caa/api-contract';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { PolicySearchService } from './policy-search.service';

/** Handlers for the policy search route. */
export interface PolicySearchController {
  readonly searchPolicies: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the policy search controller.
 *
 * @param service - Policy search service.
 * @returns A {@link PolicySearchController}.
 */
export function createPolicySearchController(service: PolicySearchService): PolicySearchController {
  return {
    searchPolicies: async (request, reply) => {
      const actor = requireActor(request);
      // SECURITY: strict query; tenant, user, role and audience come from the session only.
      const query = PolicySearchQuerySchema.safeParse(request.query);
      if (!query.success) {
        throw new InvalidRequestError();
      }
      const result = await service.search(actor, query.data, { logger: request.log });
      return sendData(reply, PolicySearchResponseSchema, result);
    },
  };
}
