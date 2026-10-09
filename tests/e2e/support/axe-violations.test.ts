/**
 * @file Proves the axe violation message names the rule id and every target.
 * @requirement T08
 * @requirement NFR-02
 */
import { describe, expect, it } from 'vitest';

import { formatAxeViolations } from './axe-violations';

describe('formatAxeViolations', () => {
  it('names the rule id, impact, help text and each target', () => {
    const message = formatAxeViolations([
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        nodes: [{ target: ['#logo'] }, { target: ['iframe', 'img.hero'] }],
      },
    ]);

    expect(message).toBe(
      [
        'image-alt (critical): Images must have alternative text',
        '    - #logo',
        '    - iframe img.hero',
      ].join('\n'),
    );
  });

  it('says what is unknown when axe reports no impact', () => {
    expect(
      formatAxeViolations([{ id: 'label', impact: null, help: 'Inputs need labels', nodes: [] }]),
    ).toBe('label (unknown impact): Inputs need labels');
  });

  it('returns an empty string when there are no violations', () => {
    expect(formatAxeViolations([])).toBe('');
  });
});
