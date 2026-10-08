/**
 * @file HTTP handler for revalidating a plan draft.
 * @module @caa/api/modules/plan-revalidation/plan-revalidation.controller
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { PlanViewSchema, RevalidatePlanRequestSchema } from '@caa/api-contract';
import { PlanIdSchema, StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { PlanRevalidationService } from './plan-revalidation.service';

const PlanParamsSchema = z.object({ studentId: StudentIdSchema, planId: PlanIdSchema });

/** Handlers for the plan revalidation routes. */
export interface PlanRevalidationController {
  readonly revalidatePlan: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the plan revalidation controller.
 *
 * @param revalidation - The revalidation service.
 * @returns The controller.
 */
export function createPlanRevalidationController(
  revalidation: PlanRevalidationService,
): PlanRevalidationController {
  return {
    revalidatePlan: async (request, reply) => {
      const actor = requireActor(request);
      // NOTE: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      const params = PlanParamsSchema.safeParse(request.params);
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: the strict schema allows only `expectedRevision`; the inputs come from the
      // stored revision and identity from the session (FR-01).
      const body = RevalidatePlanRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const plan = await revalidation.revalidatePlan(
        actor,
        { ...params.data, body: body.data },
        { logger: request.log },
      );
      return sendData(reply.code(201), PlanViewSchema, plan);
    },
  };
}
