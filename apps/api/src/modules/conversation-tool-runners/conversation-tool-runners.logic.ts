/**
 * @file A wrapper that ties a tool runner's argument type to the schema it parses with. Pure.
 * @module @caa/api/modules/conversation-tool-runners/conversation-tool-runners.logic
 * @requirement FR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import type { z } from 'zod';

import {
  failedResult,
  INVALID_ARGUMENTS,
  type ToolResult,
} from '../conversation-tools/conversation-tools.logic';

/** A tool run whose arguments are already parsed. */
export type ParsedToolRun<Run extends { readonly args: unknown }, Args> = Omit<Run, 'args'> & {
  readonly args: Args;
};

/**
 * Builds a runner that parses its arguments with the given schema, so the body's argument type
 * is the schema's output and cannot drift from it.
 *
 * @template Run - The run shape the runner receives.
 * @param schema - The tool's argument schema.
 * @param body - The runner body, given the parsed arguments.
 * @returns A runner that answers INVALID_ARGUMENTS when the arguments do not parse.
 */
export function withArgs<Run extends { readonly args: unknown }, Schema extends z.ZodType>(
  schema: Schema,
  body: (run: ParsedToolRun<Run, z.output<Schema>>) => Promise<ToolResult>,
): (run: Run) => Promise<ToolResult> {
  return (run) => {
    const parsed = schema.safeParse(run.args);
    if (!parsed.success) return Promise.resolve(failedResult(INVALID_ARGUMENTS, null));
    return body({ ...run, args: parsed.data });
  };
}
