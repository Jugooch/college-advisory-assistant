/**
 * @file The model port: how the orchestrator asks a language model for a reply. Types only.
 * @module @caa/assistant/ports/conversation-model
 * @requirement FR-01
 * @requirement FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ToolInputJsonSchema, ToolName } from '../tools/tool-catalog';

/** A tool the model may call, in the form a provider needs. */
export interface ModelToolDefinition {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: ToolInputJsonSchema;
}

/** A tool call the model asked for. The arguments are unvalidated until the tool's schema parses them. */
export interface ModelToolCall {
  /** The provider's id for this call, echoed back on its result. */
  readonly id: string;
  /** Not narrowed to {@link ToolName}: a model can name a tool that doesn't exist. */
  readonly name: string;
  readonly arguments: unknown;
}

/** A message from the student. */
export interface ModelUserMessage {
  readonly role: 'user';
  readonly text: string;
}

/** A message from the model, with the tool calls it made, if any. */
export interface ModelAssistantMessage {
  readonly role: 'assistant';
  readonly text: string;
  readonly toolCalls: readonly ModelToolCall[];
}

/** A tool's result, already minimized and wrapped as untrusted data. */
export interface ModelToolResultMessage {
  readonly role: 'tool';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly content: string;
}

/** One message in the model's context. */
export type ModelMessage = ModelUserMessage | ModelAssistantMessage | ModelToolResultMessage;

/** Why the model stopped. */
export type ModelStopReason = 'END_TURN' | 'TOOL_USE' | 'MAX_TOKENS';

/** What the orchestrator sends for one model call. */
export interface ModelRequest {
  readonly system: string;
  readonly messages: readonly ModelMessage[];
  readonly tools: readonly ModelToolDefinition[];
}

/** What the model returned. */
export interface ModelReply {
  readonly text: string;
  readonly toolCalls: readonly ModelToolCall[];
  readonly stopReason: ModelStopReason;
}

/** The orchestrator depends on this port, never on a provider SDK (ADR-0015 §1). */
export interface ConversationModel {
  /** Rejects with a typed unavailable error that the adapter defines; it never falls back to another provider. */
  respond(request: ModelRequest): Promise<ModelReply>;
}
