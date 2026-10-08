/**
 * @file The request_plan tool: ask for schedule options from the student's confirmed form.
 * @module @caa/assistant/tools/request-plan
 * @requirement FR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { defineTool, ToolName } from './tool-catalog';

// SAFETY: no arguments. Planner inputs are the student's confirmed form state, so the model can't supply or alter them (ADR-0015 §4).
/** Schema for the tool's arguments: none. */
export const RequestPlanArgsSchema = z.strictObject({});

/** The tool definition. */
export const REQUEST_PLAN_TOOL = defineTool(
  ToolName.RequestPlan,
  "Ask for schedule options using the student's confirmed planner form. Takes no arguments. If the form is incomplete the result says what is needed.",
  RequestPlanArgsSchema,
);
