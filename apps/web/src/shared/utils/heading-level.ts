/**
 * @file Heading levels for the shared cards. A card shows its heading at the level its page or
 * panel gives it, so the same card sits under the planner's `h1` and inside a chat message under
 * the panel's `h2` without skipping or repeating a level.
 * @module @caa/web/shared/utils/heading-level
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */

/** A heading level a card can use. `h1` belongs to the page. */
export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/** The element name for one {@link HeadingLevel}. */
export type HeadingTag = `h${HeadingLevel}`;

/**
 * Names the element for a heading level.
 *
 * @param level - The level.
 * @returns For example `h3`.
 */
export function headingTag(level: HeadingLevel): HeadingTag {
  return `h${String(level)}` as HeadingTag;
}

/**
 * Gives the level one step below another, stopping at `h6`.
 *
 * @param level - The parent heading's level.
 * @returns The level for its sub-headings.
 */
export function subHeadingLevel(level: HeadingLevel): HeadingLevel {
  return level === 6 ? 6 : ((level + 1) as HeadingLevel);
}
