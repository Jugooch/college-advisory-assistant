/**
 * @file HTTP handlers for the plan drafts module.
 * @module @caa/api/modules/plan-drafts/plan-drafts.controller
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { PlanViewSchema, SavePlanRequestSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { PlanDraftsService } from './plan-drafts.service';

const StudentParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the plan drafts routes. */
export interface PlanDraftsController {
  readonly savePlan: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Parses path params. A malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
 *
 * @param schema - The params schema.
 * @param params - The raw path params.
 * @returns The parsed params.
 * @throws {NotFoundError} When a param is malformed.
 */
function parseParams<TSchema extends z.ZodType>(
  schema: TSchema,
  params: unknown,
): z.output<TSchema> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new NotFoundError();
  }
  return parsed.data;
}

/**
 * Creates the plan drafts controller.
 *
 * @param drafts - The save service.
 * @returns The controller.
 */
export function createPlanDraftsController(drafts: PlanDraftsService): PlanDraftsController {
  const contextOf = (request: FastifyRequest): RequestContext => ({ logger: request.log });
  return {
    savePlan: async (request, reply) => {
      const actor = requireActor(request);
      const { studentId } = parseParams(StudentParamsSchema, request.params);
      // SECURITY: the strict schema rejects any tenant, user, role, owner, or result field;
      // identity comes only from the session (FR-01).
      const body = SavePlanRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const plan = await drafts.savePlan(actor, { studentId, body: body.data }, contextOf(request));
      return sendData(reply, PlanViewSchema, plan);
    },
  };
}
