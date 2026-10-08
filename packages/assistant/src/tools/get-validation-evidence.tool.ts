/**
 * @file The get_validation_evidence tool: read a saved plan's validation evidence.
 * @module @caa/assistant/tools/get-validation-evidence
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { PlanIdSchema } from '@caa/domain';

import { defineTool, ToolName } from './tool-catalog';

/** Schema for the tool's arguments. A plan the student can't see is reported as not found by the service. */
export const GetValidationEvidenceArgsSchema = z.strictObject({
  planId: PlanIdSchema,
  revision: z.number().int().min(1).optional(),
});

/** The tool definition. */
export const GET_VALIDATION_EVIDENCE_TOOL = defineTool(
  ToolName.GetValidationEvidence,
  "Get the validation evidence for one of the student's plans, optionally for a specific revision.",
  GetValidationEvidenceArgsSchema,
);
