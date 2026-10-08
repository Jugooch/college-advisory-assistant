/**
 * @file HTTP handler for claim, release, resolve and withdraw on an advisor case.
 * @module @caa/api/modules/case-actions/case-actions.controller
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-14
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CaseEventRequestSchema, CaseViewSchema } from '@caa/api-contract';
import { CaseIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { CaseActionsService } from './case-actions.service';

const CaseParamsSchema = z.object({ caseId: CaseIdSchema });

/** Handlers for the case action route. */
export interface CaseActionsController {
  readonly addCaseEvent: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the case actions controller.
 *
 * @param actions - The case actions service.
 * @returns The controller.
 */
export function createCaseActionsController(actions: CaseActionsService): CaseActionsController {
  return {
    addCaseEvent: async (request, reply) => {
      const actor = requireActor(request);
      // A malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      const params = CaseParamsSchema.safeParse(request.params);
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: the strict schema rejects any tenant, user, role, owner or status field, and
      // CREATE; the actor is the session's user (FR-01).
      const body = CaseEventRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const updated = await actions.addCaseEvent(
        actor,
        { caseId: params.data.caseId, body: body.data },
        { logger: request.log },
      );
      return sendData(reply.code(201), CaseViewSchema, updated);
    },
  };
}
