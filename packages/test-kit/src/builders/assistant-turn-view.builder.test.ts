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
  buildStoredNoticeTurnView,
  buildStudentTurnView,
  buildTemplateBlockEntry,
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
    expect(response.lastSequence).toBe(2);
  });

  it('derives lastSequence from the last turn it is given', () => {
    const response = buildConversationResponse({ turns: [buildStudentTurnView()] });

    expect(response.lastSequence).toBe(1);
  });

  it('keeps an explicit lastSequence', () => {
    expect(buildConversationResponse({ lastSequence: 7 }).lastSequence).toBe(7);
  });

  it('builds the unavailable response with reason DISABLED', () => {
    expect(buildUnavailableConversationResponse()).toEqual({
      available: false,
      unavailableReason: 'DISABLED',
      turns: [],
      lastSequence: 0,
    });
  });

  it('rejects an unavailable response with no reason', () => {
    expect(() => buildConversationResponse({ available: false })).toThrow();
  });
});

describe('template block builders', () => {
  it('builds an entry pointing at ref 0 with a notice block', () => {
    expect(buildTemplateBlockEntry()).toMatchObject({ refIndex: 0, block: { kind: 'NOTICE' } });
  });

  it('builds a stored turn whose re-rendered block matches its ref', () => {
    expect(ConversationTurnViewSchema.safeParse(buildStoredNoticeTurnView()).success).toBe(true);
  });

  it('rejects an entry that points at a ref it was not rendered from', () => {
    expect(() =>
      buildStoredNoticeTurnView({ templateBlocks: [buildTemplateBlockEntry({ refIndex: 1 })] }),
    ).toThrow();
  });
});
