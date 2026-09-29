/**
 * @file Contract for the current-session endpoint.
 * @module @caa/api-contract/contracts/session
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema, RoleSetSchema, StudentIdSchema, UserIdSchema } from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';

/**
 * Response body for `GET /v1/me`: who the server resolved the session to.
 *
 * SECURITY: response only. Built from the domain field schemas rather than `ActorSchema`, which no
 * contract schema embeds, so the actor can never become request input by reuse.
 */
export const MeResponseSchema = z
  .object({
    userId: UserIdSchema,
    tenantId: InstitutionIdSchema,
    roles: RoleSetSchema,
    // TODO(#169): make required
    /**
     * The student record linked to the signed-in user, so a student can be taken to their own
     * record, or `null` when the user has no linked student (for example an advisor). Resolved
     * from the session on the server, never from the request.
     */
    studentId: StudentIdSchema.nullable().optional(),
  })
  .readonly();

/** Response body for `GET /v1/me`. */
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** Returns the signed-in user's ID, institution, and roles, as resolved from the session. */
export const getMeEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/me',
  response: MeResponseSchema,
});
