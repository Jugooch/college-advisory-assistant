/**
 * @file Picks how the transcript scrolls: instantly when the student prefers reduced motion.
 * @module @caa/web/features/conversation/utils/scroll-behavior
 * @requirement NFR-02
 */

/**
 * Reads the reduced-motion preference.
 *
 * @returns `auto` (no animation) under `prefers-reduced-motion: reduce`, else `smooth`.
 */
export function transcriptScrollBehavior(): ScrollBehavior {
  const isReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 'auto' : 'smooth';
}
