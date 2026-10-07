/**
 * @file HTTP handlers for reading saved plans.
 * @module @caa/api/modules/plan-views/plan-views.controller
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-05
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { PlanListResponseSchema, PlanRevisionViewSchema, PlanViewSchema } from '@caa/api-contract';
import { PlanIdSchema, StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { PlanViewsService } from './plan-views.service';

const StudentParamsSchema = z.object({ studentId: StudentIdSchema });
const PlanParamsSchema = StudentParamsSchema.extend({ planId: PlanIdSchema });
const RevisionParamsSchema = PlanParamsSchema.extend({
  revision: z
    .string()
    .regex(/^[1-9]\d{0,8}$/)
    .transform(Number),
});

/** Handlers for the plan read routes. */
export interface PlanViewsController {
  readonly listPlans: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  readonly getPlan: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  readonly getPlanRevision: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
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
 * Creates the plan views controller.
 *
 * @param views - The read service.
 * @returns The controller.
 */
export function createPlanViewsController(views: PlanViewsService): PlanViewsController {
  const contextOf = (request: FastifyRequest): RequestContext => ({ logger: request.log });
  return {
    listPlans: async (request, reply) => {
      const actor = requireActor(request);
      const { studentId } = parseParams(StudentParamsSchema, request.params);
      const plans = await views.listPlans(actor, studentId, contextOf(request));
      return sendData(reply, PlanListResponseSchema, plans);
    },
    getPlan: async (request, reply) => {
      const actor = requireActor(request);
      const query = parseParams(PlanParamsSchema, request.params);
      return sendData(reply, PlanViewSchema, await views.getPlan(actor, query, contextOf(request)));
    },
    getPlanRevision: async (request, reply) => {
      const actor = requireActor(request);
      const query = parseParams(RevisionParamsSchema, request.params);
      const view = await views.getRevision(actor, query, contextOf(request));
      return sendData(reply, PlanRevisionViewSchema, view);
    },
  };
}
