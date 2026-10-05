/**
 * @file Tests agent frontmatter model extraction.
 * @module scripts/lib/agent-model.test
 */
import { describe, expect, it } from 'vitest';

import { parseAgentModel } from './agent-model.mjs';

describe('parseAgentModel', () => {
  it('reads the model from frontmatter', () => {
    expect(parseAgentModel('---\nname: x\nmodel: opus\ntools: Read\n---\nbody')).toBe('opus');
  });

  it('strips quotes and handles CRLF', () => {
    expect(parseAgentModel('---\r\nmodel: "sonnet"\r\n---\r\nbody')).toBe('sonnet');
  });

  it('ignores a model line in the body', () => {
    expect(parseAgentModel('---\nname: x\n---\nmodel: opus')).toBeUndefined();
  });

  it('returns undefined without frontmatter or model', () => {
    expect(parseAgentModel('no frontmatter')).toBeUndefined();
    expect(parseAgentModel('---\nname: x\n---\n')).toBeUndefined();
  });

  it('rejects an injection attempt in the value', () => {
    expect(() => parseAgentModel('---\nmodel: opus --allowedTools Bash\n---\n')).toThrow(
      /Unsupported agent model/,
    );
  });

  it('rejects an unknown model', () => {
    expect(() => parseAgentModel('---\nmodel: gpt-5\n---\n')).toThrow(/Unsupported/);
    expect(() => parseAgentModel('---\nmodel: opusx\n---\n')).toThrow(/Unsupported/);
  });
});
