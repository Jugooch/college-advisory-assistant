/**
 * @file HTTP handlers for the plannable terms module.
 * @module @caa/api/modules/plannable-terms/plannable-terms.controller
 * @requirement FR-08
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { PlannableTermsResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { PlannableTermsService } from './plannable-terms.service';

const PlannableTermsParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the plannable terms routes. */
export interface PlannableTermsController {
  readonly listTerms: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the plannable terms controller.
 *
 * @param service - The plannable terms service.
 * @returns The controller.
 */
export function createPlannableTermsController(
  service: PlannableTermsService,
): PlannableTermsController {
  return {
    listTerms: async (request, reply) => {
      const actor = requireActor(request);
      const params = PlannableTermsParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: identity comes only from the session; query and headers are never read.
      const context: RequestContext = { logger: request.log };
      const terms = await service.listPlannableTerms(actor, params.data.studentId, context);
      return sendData(reply, PlannableTermsResponseSchema, terms);
    },
  };
}
