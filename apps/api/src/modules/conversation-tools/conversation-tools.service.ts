/**
 * @file Runs one assistant tool call for one student. Identity is the session's: the actor and
 * the student come from the caller, never from the model's arguments. The call is validated
 * with the assistant's strict schemas, access is checked, a runner reads through an existing
 * service, and the projection is wrapped as untrusted data for the model. A service failure
 * becomes an error code and a notice; it never throws.
 * @module @caa/api/modules/conversation-tools/conversation-tools.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement FR-16
 * @requirement AC43
 * @requirement AC44
 * @requirement AC45
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import type { ScheduleOptionsRequest } from '@caa/api-contract';
import {
  ALL_TOOLS,
  type ModelToolCall,
  renderNotice,
  TEMPLATE_VERSION,
  type ToolName,
  wrapUntrustedData,
} from '@caa/assistant';
import { type Actor, ErrorCode, type StudentId } from '@caa/domain';

import { DomainError, NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { ConversationToolRunnersService } from '../conversation-tool-runners/conversation-tool-runners.service';
import {
  buildNotice,
  failedResult,
  failureNotice,
  INVALID_ARGUMENTS,
  type ToolOutcome,
  type ToolResult,
  UNKNOWN_TOOL,
} from './conversation-tools.logic';

/** Dependencies of the conversation tools. */
export interface ConversationToolsServiceDependencies {
  readonly access: Pick<AccessService, 'canConverse'>;
  /** One runner per tool; each reads through an existing service. */
  readonly runners: ConversationToolRunnersService;
}

/**
 * One tool call and what the server knows about the turn, none of it from the model: the
 * student from the path (checked against the session) and the planner form's confirmed state.
 */
export interface ToolInvocation {
  /** The model's call; its arguments are untrusted. */
  readonly call: ModelToolCall;
  readonly studentId: StudentId;
  /** The planner form's confirmed state, or `undefined` when the form is empty. */
  readonly plannerInputs?: ScheduleOptionsRequest | undefined;
}

/** Runs one tool call. */
export interface ConversationToolsService {
  /**
   * Validates and runs one tool call for the session's student.
   *
   * @param actor - Authenticated actor from the session.
   * @param invocation - The model's call, the student, and the planner form state.
   * @param context - Request-scoped values.
   * @returns The projection for the model, and the block or notice for the student. Never
   *   throws for a service failure: the failure becomes an error code and a notice.
   */
  executeTool(
    actor: Actor,
    invocation: ToolInvocation,
    context: RequestContext,
  ): Promise<ToolOutcome>;
}

/** A result and the catalog name it belongs to, or `null` for a name the catalog lacks. */
interface NamedResult {
  readonly result: ToolResult;
  readonly toolName: ToolName | null;
}

/**
 * Turns a thrown error into a result. The notice always renders from a fixed template, so a
 * stored notice re-renders to the same text. STALE_SOURCE and SOURCE_UNAVAILABLE get their own
 * notices; every other failure gets TOOL_FAILED. A domain error keeps its code, and anything
 * else is INTERNAL_ERROR.
 *
 * @param error - What the tool threw.
 * @returns A result with a fixed notice.
 */
function toFailure(error: unknown): ToolResult {
  const code = error instanceof DomainError ? error.code : ErrorCode.InternalError;
  // SAFETY: a stale or unreachable source gets its own fixed notice, never a generic failure.
  const { noticeCode, templateId } = failureNotice(code);
  return failedResult(
    code,
    buildNotice(noticeCode, {
      id: templateId,
      version: TEMPLATE_VERSION,
      text: renderNotice(noticeCode),
    }),
  );
}

/**
 * Creates the conversation tools service.
 *
 * @param dependencies - Access rule and the read services the tools call.
 * @returns A {@link ConversationToolsService}.
 */
export function createConversationToolsService(
  dependencies: ConversationToolsServiceDependencies,
): ConversationToolsService {
  const { access, runners } = dependencies;

  const run = async (
    actor: Actor,
    invocation: ToolInvocation,
    context: RequestContext,
  ): Promise<NamedResult> => {
    const { call, studentId, plannerInputs } = invocation;
    const definition = ALL_TOOLS.find((tool) => tool.name === call.name);
    if (definition === undefined) {
      return { result: failedResult(UNKNOWN_TOOL, null), toolName: null };
    }
    const toolName = definition.name;
    // SECURITY: arguments are strict, so a smuggled studentId, tenantId or role is refused
    // before any service is called.
    const parsed = definition.argumentsSchema.safeParse(call.arguments);
    if (!parsed.success) return { result: failedResult(INVALID_ARGUMENTS, null), toolName };
    try {
      // SECURITY: the student must be the session's own; anyone else gets NOT_FOUND.
      if (!(await access.canConverse(actor, studentId, context))) {
        throw new NotFoundError();
      }
      const result = await runners[toolName]({
        actor,
        studentId,
        plannerInputs,
        args: parsed.data,
        context,
      });
      return { result, toolName };
    } catch (error) {
      return { result: toFailure(error), toolName };
    }
  };

  return {
    async executeTool(actor, invocation, context) {
      const { result, toolName } = await run(actor, invocation, context);
      // SECURITY: no arguments or text are logged (FR-14).
      context.logger.info(
        { tenantId: actor.tenantId, tool: toolName, errorCode: result.errorCode },
        'conversation tool run',
      );
      return {
        ...result,
        // SECURITY: tool output is data, never instructions (ADR-0015 section 4). An unknown
        // tool has no catalog name to wrap under, so it gets only the fixed error code.
        modelText:
          toolName === null
            ? JSON.stringify(result.projection)
            : wrapUntrustedData(toolName, result.projection),
      };
    },
  };
}
