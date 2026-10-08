/**
 * @file Wraps a tool's minimized result in fixed delimiters so the model reads it as data.
 * @module @caa/assistant/prompts/untrusted-data
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ToolName } from '../tools/tool-catalog';

/** Opening delimiter; the tool name follows as an attribute and the tag closes with `>`. */
export const TOOL_DATA_OPEN = '<tool_data';

/** Closing delimiter. */
export const TOOL_DATA_CLOSE = '</tool_data>';

/** A JSON-serializable value: the shape of a minimized tool projection. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Characters that could form or alter a delimiter, and their JSON `\u` escapes. */
const ESCAPES: Readonly<Record<string, string>> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
};

/**
 * Wraps a tool's minimized projection in `<tool_data>` delimiters.
 *
 * The projection is serialized as JSON with `<`, `>` and `&` written as `\u` escapes. The result
 * is still valid JSON that decodes to the original text, but no projection can contain a literal
 * delimiter, so it can't close the wrapper early.
 *
 * @param toolName - The tool that produced the projection.
 * @param projection - The minimized result, never the full service response.
 * @returns The wrapped text to send as the tool result.
 */
export function wrapUntrustedData(toolName: ToolName, projection: JsonValue): string {
  // SECURITY: tool output is data, not instructions; an embedded delimiter must not end the data region (ADR-0015 §4, planning/10).
  const body = JSON.stringify(projection).replace(/[<>&]/g, (char) => ESCAPES[char] ?? char);
  return `${TOOL_DATA_OPEN} tool="${toolName}">\n${body}\n${TOOL_DATA_CLOSE}`;
}
