/**
 * @file Pure parts of the conversation tools shared by every tool: the outcome shape and the notice and
 * failure builders. Nothing here reads a clock, a store, or a service.
 * @module @caa/api/modules/conversation-tools/conversation-tools.logic
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import type { AssistantBlock } from '@caa/api-contract';
import { AssistantBlockKind, ErrorCode, NoticeCode } from '@caa/domain';

/** A JSON-serializable value: the shape of a minimized tool projection. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Code for arguments that fail the tool's schema or its cross-field rules. */
export const INVALID_ARGUMENTS = 'INVALID_ARGUMENTS';

/** Code for a tool name the catalog doesn't have. */
export const UNKNOWN_TOOL = 'UNKNOWN_TOOL';

/** Why a tool produced no result: a service error code or one of the tool layer's own. */
export type ToolErrorCode = ErrorCode | typeof INVALID_ARGUMENTS | typeof UNKNOWN_TOOL;

/** Template ID of the notice shown when a tool fails. */
export const TOOL_FAILED_TEMPLATE_ID = 'notice.tool-failed';

/** Template ID of the notice shown when a source is out of date. */
export const STALE_SOURCE_TEMPLATE_ID = 'notice.stale-source';

/** Template ID of the notice shown when a source can't be reached. */
export const SOURCE_UNAVAILABLE_TEMPLATE_ID = 'notice.source-unavailable';

/** Template ID of the notice shown when the planner form can't be used. */
export const PLANNER_INPUT_TEMPLATE_ID = 'notice.planner-input-needed';

/** What one tool call produces. Block and notice come from services and templates, never the model. */
export interface ToolOutcome {
  /** The minimized result for the model, with no names, emails, IDs, grades, or notes. */
  readonly projection: JsonValue;
  /** The projection wrapped as untrusted data, ready to send as the tool result. */
  readonly modelText: string;
  /** The verified view the student sees, or `null` when the tool produced none. */
  readonly block: AssistantBlock | null;
  /** A fixed-text notice the student sees instead of or beside a block, or `null`. */
  readonly notice: AssistantBlock | null;
  /** The failure code, or `null` on success. */
  readonly errorCode: ToolErrorCode | null;
}

/** The parts of an outcome a tool decides; the service adds the wrapped text. */
export type ToolResult = Omit<ToolOutcome, 'modelText'>;

/** Identity, version and fixed text of a notice template. */
export interface NoticeTemplate {
  readonly id: string;
  readonly version: string;
  readonly text: string;
}

/**
 * Builds a notice block from a fixed template.
 *
 * @param code - Which notice.
 * @param template - The template's ID, version, and fixed text.
 * @returns A notice block.
 */
export function buildNotice(code: NoticeCode, template: NoticeTemplate): AssistantBlock {
  return {
    kind: AssistantBlockKind.Notice,
    code,
    templateId: template.id,
    templateVersion: template.version,
    text: template.text,
  };
}

/**
 * Builds the result of a tool that failed.
 *
 * @param errorCode - Why it failed.
 * @param notice - The notice for the student, or `null` when the student should not see it.
 * @returns A result with no block.
 */
export function failedResult(errorCode: ToolErrorCode, notice: AssistantBlock | null): ToolResult {
  return { projection: { error: errorCode }, block: null, notice, errorCode };
}

/**
 * Picks the fixed notice for a failure code. Stale and unavailable sources keep their own
 * notices; everything else is the generic tool failure.
 *
 * @param code - Why the tool failed.
 * @returns The notice code and the ID of its template.
 */
export function failureNotice(code: ToolErrorCode): {
  readonly noticeCode: NoticeCode;
  readonly templateId: string;
} {
  // SAFETY: a stale or unreachable source is never reported as a generic failure.
  if (code === ErrorCode.StaleSource) {
    return { noticeCode: NoticeCode.StaleSource, templateId: STALE_SOURCE_TEMPLATE_ID };
  }
  if (code === ErrorCode.SourceUnavailable) {
    return { noticeCode: NoticeCode.SourceUnavailable, templateId: SOURCE_UNAVAILABLE_TEMPLATE_ID };
  }
  return { noticeCode: NoticeCode.ToolFailed, templateId: TOOL_FAILED_TEMPLATE_ID };
}
