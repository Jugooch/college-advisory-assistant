/**
 * @file The propose_constraints tool: propose schedule constraints for the student to confirm.
 * @module @caa/assistant/tools/propose-constraints
 * @requirement FR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { MAX_SCHEDULE_CONSTRAINTS, ScheduleConstraintSchema } from '@caa/domain';

import { defineTool, ToolName } from './tool-catalog';

/** Schema for the tool's arguments: constraints in the domain schema, so nothing is reinterpreted. */
export const ProposeConstraintsArgsSchema = z.strictObject({
  constraints: z.array(ScheduleConstraintSchema).min(1).max(MAX_SCHEDULE_CONSTRAINTS).readonly(),
});

// SAFETY: this tool only validates. The orchestrator downgrades each item to PREFERRED and the student confirms it in the form (ADR-0015 §4, FR-08).
/** The tool definition. */
export const PROPOSE_CONSTRAINTS_TOOL = defineTool(
  ToolName.ProposeConstraints,
  'Propose schedule constraints from what the student said. Nothing is applied: the student reviews each one and decides whether it is a hard rule.',
  ProposeConstraintsArgsSchema,
);
