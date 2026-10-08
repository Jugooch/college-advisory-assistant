/**
 * @file Tests for the synthetic assistant turn view and conversation response builders.
 */
import { describe, expect, it } from 'vitest';

import {
  AssistantTurnViewSchema,
  ConversationResponseSchema,
  ConversationTurnViewSchema,
} from '@caa/api-contract';

import {
  buildAssistantTurnView,
  buildConversationResponse,
  buildStoredAssistantTurnView,
  buildStudentTurnView,
  buildUnavailableConversationResponse,
} from './assistant-turn-view.builder';

describe('buildAssistantTurnView', () => {
  it('defaults to an answered turn at sequence 2 with one policy results block', () => {
    const view = buildAssistantTurnView();

    expect(AssistantTurnViewSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({ sequence: 2, modelStatus: 'ANSWERED' });
    expect(view.blocks.map((block) => block.kind)).toEqual(['POLICY_RESULTS']);
  });

  it('accepts a rate-limited turn with no sequence', () => {
    expect(
      buildAssistantTurnView({ sequence: null, modelStatus: 'RATE_LIMITED', blocks: [] }),
    ).toMatchObject({ sequence: null });
  });

  it('rejects a stored status with no sequence', () => {
    expect(() => buildAssistantTurnView({ sequence: null })).toThrow();
  });
});

describe('conversation turn view builders', () => {
  it('build a student and an assistant turn that parse', () => {
    expect(ConversationTurnViewSchema.safeParse(buildStudentTurnView()).success).toBe(true);
    expect(ConversationTurnViewSchema.safeParse(buildStoredAssistantTurnView()).success).toBe(true);
  });
});

describe('buildConversationResponse', () => {
  it('defaults to an available transcript of two turns in order', () => {
    const response = buildConversationResponse();

    expect(ConversationResponseSchema.safeParse(response).success).toBe(true);
    expect(response.turns.map((turn) => turn.sequence)).toEqual([1, 2]);
  });

  it('builds the unavailable response with reason DISABLED', () => {
    expect(buildUnavailableConversationResponse()).toEqual({
      available: false,
      unavailableReason: 'DISABLED',
      turns: [],
    });
  });

  it('rejects an unavailable response with no reason', () => {
    expect(() => buildConversationResponse({ available: false })).toThrow();
  });
});
