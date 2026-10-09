/**
 * @file Test setup: jsdom has no layout, so it lacks `scrollIntoView`. A no-op stands in, and
 * tests that care about scrolling replace it with a spy.
 * @see docs/standards/07-testing.md
 */
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => undefined;
}
