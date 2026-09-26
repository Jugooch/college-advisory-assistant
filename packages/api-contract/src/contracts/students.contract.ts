/**
 * @file Contracts for the student endpoints.
 * @module @caa/api-contract/contracts/students
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { z } from 'zod';

import { StudentSchema } from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';

/**
 * Response body for `GET /v1/students/:studentId`.
 *
 * SECURITY: data minimization. Exposes only the internal and source IDs; the tenant and linked
 * login stay on the server.
 */
export const StudentResponseSchema = StudentSchema.unwrap()
  .pick({ id: true, sourceStudentId: true })
  .readonly();

/** Response body for `GET /v1/students/:studentId`. */
export type StudentResponse = z.infer<typeof StudentResponseSchema>;

/** Reads one student the signed-in user is allowed to see. Others are NOT_FOUND. */
export const getStudentEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId',
  response: StudentResponseSchema,
});
