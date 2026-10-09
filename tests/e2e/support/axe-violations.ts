/**
 * @file Formats axe violations into a failure message that names each rule id and target, so a
 *   failed accessibility check says what to fix without opening the report.
 * @module @caa/tests/e2e/support/axe-violations
 * @requirement T08
 * @requirement NFR-02
 */

/** The part of an axe violation node the message uses. */
export interface AxeViolationNode {
  /** CSS selector path to the element, one entry per frame or shadow root. */
  readonly target: readonly unknown[];
}

/** The part of an axe violation the message uses. */
export interface AxeViolation {
  /** The axe rule id, for example `image-alt`. */
  readonly id: string;
  /** How serious axe rates the violation; absent or null when axe gives none. */
  readonly impact?: string | null;
  /** One-line description of what the rule requires. */
  readonly help: string;
  /** The elements that break the rule. */
  readonly nodes: readonly AxeViolationNode[];
}

/**
 * Describes axe violations for a test failure.
 *
 * @param violations - The violations axe reported.
 * @returns An empty string when there are none; otherwise one line per violation and one per target.
 */
export function formatAxeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map((violation) => {
      const impact = violation.impact ?? 'unknown impact';
      const targets = violation.nodes.map((node) => `    - ${node.target.map(String).join(' ')}`);
      return [`${violation.id} (${impact}): ${violation.help}`, ...targets].join('\n');
    })
    .join('\n');
}
