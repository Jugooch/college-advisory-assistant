/**
 * @file Tests for the tool catalog: six tools, strict schemas, and no identity fields.
 */
import { describe, expect, it } from 'vitest';

import { ALL_TOOLS, MODEL_TOOL_DEFINITIONS } from './all-tools.tool';
import { TOOL_NAMES, TOOL_SCHEMA_VERSION } from './tool-catalog';

const IDENTITY_FIELDS = [
  'tenantId',
  'userId',
  'studentId',
  'role',
  'actorId',
  'actorRole',
  'sessionId',
];

const PLAN_ID = 'c4a1b2c3-0000-4000-8000-0000000000aa';

/** Valid arguments for each tool, by name. */
const VALID_ARGS: Readonly<Record<string, unknown>> = {
  get_academic_summary: {},
  search_approved_policy: { query: 'repeat a course', topic: 'GENERAL' },
  propose_constraints: {
    constraints: [
      {
        kind: 'UNAVAILABLE_TIME',
        strength: 'PREFERRED',
        priorityRank: 1,
        weekdays: ['FRIDAY'],
        startTime: '00:00',
        endTime: '24:00',
      },
    ],
  },
  request_plan: {},
  get_validation_evidence: { planId: PLAN_ID, revision: 2 },
  draft_case_context: { reason: 'PLAN_REVIEW', planId: PLAN_ID },
};

/**
 * Finds a tool's argument schema by name.
 *
 * @param name - The tool name.
 * @returns The tool's schema; fails the test if the tool is missing.
 */
function schemaOf(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`missing tool ${name}`);
  return tool.argumentsSchema;
}

describe('tool catalog', () => {
  it('names all six tools, each defined once', () => {
    expect(ALL_TOOLS.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
    expect(TOOL_NAMES).toHaveLength(6);
    expect(MODEL_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
  });

  it('exports a tool schema version', () => {
    expect(TOOL_SCHEMA_VERSION).toMatch(/^tools-/);
  });

  describe.each(ALL_TOOLS.map((tool) => [tool.name, tool] as const))('%s', (name, tool) => {
    const valid = VALID_ARGS[name];

    it('accepts valid arguments', () => {
      expect(tool.argumentsSchema.safeParse(valid).success).toBe(true);
    });

    it('refuses an unknown key', () => {
      const withExtra = { ...(valid as object), unexpected: 1 };
      expect(tool.argumentsSchema.safeParse(withExtra).success).toBe(false);
    });

    it.each(IDENTITY_FIELDS)('refuses the identity field %s', (field) => {
      const withIdentity = { ...(valid as object), [field]: 'x' };
      expect(tool.argumentsSchema.safeParse(withIdentity).success).toBe(false);
    });

    it('has a description and a JSON schema with no identity property', () => {
      expect(tool.description.length).toBeGreaterThan(20);
      const properties = Object.keys(
        (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
      );
      expect(properties.filter((key) => IDENTITY_FIELDS.includes(key))).toEqual([]);
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    });
  });

  it('bounds the policy query to 1-200 characters', () => {
    const schema = schemaOf('search_approved_policy');
    expect(schema.safeParse({ query: '' }).success).toBe(false);
    expect(schema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
    expect(schema.safeParse({ query: 'a'.repeat(200) }).success).toBe(true);
  });

  it('has no free-text note on draft_case_context', () => {
    const schema = schemaOf('draft_case_context');
    expect(
      schema.safeParse({ reason: 'PLAN_REVIEW', suggestedNote: 'Please review.' }).success,
    ).toBe(false);
  });

  it('rejects an empty or invalid constraint list', () => {
    const schema = schemaOf('propose_constraints');
    expect(schema.safeParse({ constraints: [] }).success).toBe(false);
    expect(schema.safeParse({ constraints: [{ kind: 'NOPE' }] }).success).toBe(false);
  });
});
