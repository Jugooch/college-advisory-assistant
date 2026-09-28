/**
 * @file HTTP handlers for the academic summary module.
 * @module @caa/api/modules/academic-summary/academic-summary.controller
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { AcademicSummaryResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import { toAcademicSummaryResponse } from './academic-summary.mapper';
import type { AcademicSummaryService } from './academic-summary.service';

/** Path params of `GET /v1/students/:studentId/academic-summary`. */
const AcademicSummaryParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the academic summary routes, as properties so routes can take them unbound. */
export interface AcademicSummaryController {
  readonly getAcademicSummary: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
}

/**
 * Creates the academic summary controller.
 *
 * @param service - Academic summary service.
 * @returns An {@link AcademicSummaryController}.
 */
export function createAcademicSummaryController(
  service: AcademicSummaryService,
): AcademicSummaryController {
  return {
    getAcademicSummary: async (request, reply) => {
      const actor = requireActor(request);
      const params = AcademicSummaryParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      const context: RequestContext = { logger: request.log };
      const summary = await service.getAcademicSummary(actor, params.data.studentId, context);
      return sendData(reply, AcademicSummaryResponseSchema, toAcademicSummaryResponse(summary));
    },
  };
}
