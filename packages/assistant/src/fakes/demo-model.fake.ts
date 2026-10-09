/**
 * @file A keyword-driven ConversationModel for CONVERSATION_MODEL=demo: no key, no network.
 * @module @caa/assistant/fakes/demo-model
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { CaseReason, ConstraintStrength, ScheduleConstraintKind, Weekday } from '@caa/domain';

import type {
  ConversationModel,
  ModelMessage,
  ModelReply,
  ModelToolCall,
} from '../ports/conversation-model.port';
import { IntroId } from '../templates/intro.template';
import { POLICY_QUERY_MAX_LENGTH } from '../tools/search-approved-policy.tool';
import { ToolName } from '../tools/tool-catalog';

const POLICY_WORDS = ['policy', 'drop', 'withdraw'] as const;
const CASE_WORDS = ['advisor', 'case'] as const;
const AID_WORDS = ['financial aid', 'scholarship', 'fafsa', ' aid'] as const;

/** Intro per tool, in the order the demo prefers when a turn calls several. */
const INTRO_BY_TOOL: readonly (readonly [string, IntroId])[] = [
  [ToolName.RequestPlan, IntroId.ScheduleOptions],
  [ToolName.SearchApprovedPolicy, IntroId.PolicyResults],
  [ToolName.DraftCaseContext, IntroId.CasePreview],
  [ToolName.ProposeConstraints, IntroId.ConstraintProposal],
];

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function lastUserIndex(messages: readonly ModelMessage[]): number {
  return messages.findLastIndex((message) => message.role === 'user');
}

function callsFor(userText: string, turnKey: string): readonly ModelToolCall[] {
  const text = ` ${userText.toLowerCase()}`;
  const calls: { name: string; args: unknown }[] = [];
  if (hasAny(text, AID_WORDS)) {
    return [];
  }
  if (text.includes('friday')) {
    calls.push({
      name: ToolName.ProposeConstraints,
      args: {
        constraints: [
          {
            kind: ScheduleConstraintKind.UnavailableTime,
            strength: ConstraintStrength.Preferred,
            priorityRank: 1,
            weekdays: [Weekday.Friday],
            startTime: '00:00',
            endTime: '24:00',
          },
        ],
      },
    });
  }
  if (text.includes('options')) {
    calls.push({ name: ToolName.RequestPlan, args: {} });
  }
  if (hasAny(text, POLICY_WORDS)) {
    calls.push({
      name: ToolName.SearchApprovedPolicy,
      args: { query: userText.trim().slice(0, POLICY_QUERY_MAX_LENGTH) },
    });
  }
  if (hasAny(text, CASE_WORDS)) {
    calls.push({ name: ToolName.DraftCaseContext, args: { reason: CaseReason.PlanReview } });
  }
  return calls.map((call, index) => ({
    id: `demo-${turnKey}-${String(index)}`,
    name: call.name,
    arguments: call.args,
  }));
}

/**
 * Whether request_plan came back as a planner-input notice, so no schedule block exists.
 *
 * @param turn - The messages after the student's latest message.
 * @returns True when the plan result is the notice only.
 */
function isNoticeOnly(turn: readonly ModelMessage[]): boolean {
  return turn.some(
    (message) =>
      message.role === 'tool' &&
      message.toolName === ToolName.RequestPlan &&
      message.content.includes('"plannerInputNeeded":true'),
  );
}

function introFor(calledTools: readonly string[], userText: string, noticeOnly: boolean): IntroId {
  // SAFETY: the intro must match the blocks that came back, so a notice-only plan gets no schedule intro.
  const match = INTRO_BY_TOOL.find(
    ([tool]) => calledTools.includes(tool) && !(noticeOnly && tool === ToolName.RequestPlan),
  );
  if (match) {
    return match[1];
  }
  return hasAny(` ${userText.toLowerCase()}`, AID_WORDS)
    ? IntroId.CannotHelp
    : IntroId.AskForDetail;
}

/**
 * Creates the demo model. It reads only the current turn, so the same messages always give the same reply.
 *
 * @returns A model that calls tools by keyword, then replies with exactly one intro id.
 */
export function createDemoModel(): ConversationModel {
  return {
    respond: ({ messages }) => {
      const userIndex = lastUserIndex(messages);
      const user = messages[userIndex];
      const userText = user?.role === 'user' ? user.text : '';
      const turn = messages.slice(userIndex + 1);
      const hasToolResults = turn.some((message) => message.role === 'tool');
      const calls = hasToolResults ? [] : callsFor(userText, String(userIndex));
      const calledTools = turn.flatMap((message) =>
        message.role === 'assistant' ? message.toolCalls.map((call) => call.name) : [],
      );
      const reply: ModelReply =
        calls.length > 0
          ? { text: '', toolCalls: calls, stopReason: 'TOOL_USE' }
          : {
              text: introFor(calledTools, userText, isNoticeOnly(turn)),
              toolCalls: [],
              stopReason: 'END_TURN',
            };
      return Promise.resolve(reply);
    },
  };
}
