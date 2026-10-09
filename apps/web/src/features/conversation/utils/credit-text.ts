/**
 * @file Formats an optional credit bound as text, shared by the chip editor and the form fill.
 * @module @caa/web/features/conversation/utils/credit-text
 * @requirement FR-08
 */
import { formatCredits } from '@/shared/utils/format-display';

/**
 * Formats an optional credit bound for a text field.
 *
 * @param hundredths - The bound, or null.
 * @returns The text, blank for no bound.
 */
export function creditText(hundredths: number | null): string {
  return hundredths === null ? '' : formatCredits(hundredths);
}
