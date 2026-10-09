/**
 * @file The props every chip edit field group takes.
 * @module @caa/web/features/conversation/components/chip-fields-props
 * @requirement FR-08
 */
import type { ChipDraft } from '../utils/chip-draft';

/** Props shared by the chip edit field groups. */
export interface ChipFieldsProps {
  readonly id: string;
  readonly draft: ChipDraft;
  /** The id of the error message shown for this edit, or `null` when there is none. */
  readonly errorId: string | null;
  readonly onChange: (change: Partial<ChipDraft>) => void;
}
