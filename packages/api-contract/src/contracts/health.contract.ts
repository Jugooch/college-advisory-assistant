/**
 * @file Contract for the API health endpoint.
 * @module @caa/api-contract/contracts/health
 */
import { z } from 'zod';

import { defineEndpoint } from '../define-endpoint';

/** Response body for `GET /v1/health`. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  checkedAt: z.iso.datetime({ offset: true }),
});

/** Response body for `GET /v1/health`. */
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Reports whether the API process is running. Does not check source freshness. */
export const getHealthEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/health',
  response: HealthResponseSchema,
});
