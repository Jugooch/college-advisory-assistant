/**
 * @file Names the heading of each schedule option, so the comparison table can link to it. The
 * prefix is unique per results block, so several blocks on one page never share an id.
 * @module @caa/web/shared/utils/option-heading-id
 * @requirement FR-09
 */

/**
 * Builds the heading id of one option.
 *
 * @param prefix - An id unique to the results block, such as a `useId` value.
 * @param rank - The option's rank.
 * @returns The id the option's heading carries and the table links to.
 */
export function optionHeadingId(prefix: string, rank: number): string {
  return `${prefix}-option-${String(rank)}`;
}
