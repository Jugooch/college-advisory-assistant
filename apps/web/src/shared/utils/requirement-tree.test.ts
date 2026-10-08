/**
 * @file Tests for arranging requirements into their tree.
 */
import { describe, expect, it } from 'vitest';

import { buildRequirementResult } from '@caa/test-kit';

import { buildRequirementTree } from './requirement-tree';

describe('buildRequirementTree', () => {
  it('nests children under their parent and keeps audit order at each level', () => {
    const core = buildRequirementResult({ label: 'Core' }, 1);
    const calculus = buildRequirementResult(
      { label: 'Calculus', parentSourceRequirementId: 'REQ-001' },
      2,
    );
    const writing = buildRequirementResult({ label: 'Writing' }, 3);
    const algebra = buildRequirementResult(
      { label: 'Algebra', parentSourceRequirementId: 'REQ-001' },
      4,
    );

    const tree = buildRequirementTree([core, calculus, writing, algebra]);

    expect(
      tree.map((node) => [
        node.requirement.label,
        node.children.map((child) => child.requirement.label),
      ]),
    ).toEqual([
      ['Core', ['Calculus', 'Algebra']],
      ['Writing', []],
    ]);
  });
});
