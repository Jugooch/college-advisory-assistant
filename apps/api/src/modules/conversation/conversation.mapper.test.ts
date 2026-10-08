/**
 * @file Tests of the metadata stored with an answer.
 * @requirement FR-14
 * @requirement AC44
 */
import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, TEMPLATE_VERSION, TOOL_SCHEMA_VERSION } from '@caa/assistant';

import { buildMetadata } from './conversation.mapper';

describe('buildMetadata', () => {
  it('records the model, the versions, the reasons and the policy revisions', () => {
    expect(buildMetadata('m', ['R'], [])).toEqual({
      modelId: 'm',
      promptVersion: PROMPT_VERSION,
      toolSchemaVersion: TOOL_SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      guardReasons: ['R'],
      policyRevisions: [],
    });
  });
});
