/**
 * @file Standard response envelopes. Every API response is `{ data }` or `{ error }`.
 * @module @caa/api-contract/envelope
 * @see docs/standards/05-api-design.md
 */
import { z } from 'zod';

import { ErrorCodeSchema } from '@caa/domain';

/** Schema for the body of every failed response. */
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});

/** Body of every failed response. */
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/** Outer shape of every successful response. The payload is validated separately. */
export const SuccessEnvelopeSchema = z.object({ data: z.unknown() });
