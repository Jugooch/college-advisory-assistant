/**
 * @file The draft_case_context tool: draft an advisor-case preview. Nothing is created.
 * @module @caa/assistant/tools/draft-case-context
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { CaseReasonSchema, DiscrepancySubjectSchema, PlanIdSchema } from '@caa/domain';

import { defineTool, ToolName } from './tool-catalog';

/** Longest suggested case note, in characters. */
export const CASE_NOTE_MAX_LENGTH = 500;

/** Schema for the tool's arguments. No student or queue: both come from the session and the case flow. */
export const DraftCaseContextArgsSchema = z.strictObject({
  reason: CaseReasonSchema,
  planId: PlanIdSchema.optional(),
  discrepancySubject: DiscrepancySubjectSchema.optional(),
  suggestedNote: z.string().max(CASE_NOTE_MAX_LENGTH).optional(),
});

// SAFETY: a preview only. The student submits through the case flow, and the note passes the output guard first (ADR-0015 §4).
/** The tool definition. */
export const DRAFT_CASE_CONTEXT_TOOL = defineTool(
  ToolName.DraftCaseContext,
  'Draft a preview of a request to an advisor, with a reason and an optional short note. Nothing is created or sent; the student reviews and submits it.',
  DraftCaseContextArgsSchema,
);
