/**
 * @file HTTP handlers for creating and reading the student's advisor cases.
 * @module @caa/api/modules/cases/cases.controller
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CaseListResponseSchema, CaseViewSchema, CreateCaseRequestSchema } from '@caa/api-contract';
import { CaseIdSchema, StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { CasesService } from './cases.service';

const StudentParamsSchema = z.object({ studentId: StudentIdSchema });
const CaseParamsSchema = z.object({ caseId: CaseIdSchema });

/** Handlers for the case routes. */
export interface CasesController {
  readonly createCase: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  readonly listStudentCases: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  readonly getCase: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
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
 * Creates the cases controller.
 *
 * @param cases - The cases service.
 * @returns The controller.
 */
export function createCasesController(cases: CasesService): CasesController {
  const contextOf = (request: FastifyRequest): RequestContext => ({ logger: request.log });
  return {
    createCase: async (request, reply) => {
      const actor = requireActor(request);
      const { studentId } = parseParams(StudentParamsSchema, request.params);
      // SECURITY: the strict schema rejects any tenant, user, role, owner, or status field;
      // identity comes only from the session (FR-01).
      const body = CreateCaseRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const created = await cases.createCase(
        actor,
        { studentId, body: body.data },
        contextOf(request),
      );
      return sendData(reply.code(201), CaseViewSchema, created);
    },
    listStudentCases: async (request, reply) => {
      const actor = requireActor(request);
      const { studentId } = parseParams(StudentParamsSchema, request.params);
      const list = await cases.listStudentCases(actor, studentId, contextOf(request));
      return sendData(reply, CaseListResponseSchema, list);
    },
    getCase: async (request, reply) => {
      const actor = requireActor(request);
      const { caseId } = parseParams(CaseParamsSchema, request.params);
      return sendData(
        reply,
        CaseViewSchema,
        await cases.getCase(actor, caseId, contextOf(request)),
      );
    },
  };
}
