/**
 * @file The draft_case_context tool: draft an advisor-case preview. Nothing is created.
 * @module @caa/assistant/tools/draft-case-context
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { CaseReasonSchema, DiscrepancySubjectSchema, PlanIdSchema } from '@caa/domain';

import { defineTool, ToolName } from './tool-catalog';

/** Schema for the tool's arguments. No student or queue: both come from the session and the case flow. */
export const DraftCaseContextArgsSchema = z.strictObject({
  reason: CaseReasonSchema,
  planId: PlanIdSchema.optional(),
  discrepancySubject: DiscrepancySubjectSchema.optional(),
});

// SAFETY: a preview only. The student submits through the case flow, and the model supplies no free text (ADR-0015 Amendment 1).
/** The tool definition. */
export const DRAFT_CASE_CONTEXT_TOOL = defineTool(
  ToolName.DraftCaseContext,
  'Draft a preview of a request to an advisor, with a reason and an optional plan or discrepancy reference. The model writes no note. Nothing is created or sent; the student reviews and submits it.',
  DraftCaseContextArgsSchema,
);
