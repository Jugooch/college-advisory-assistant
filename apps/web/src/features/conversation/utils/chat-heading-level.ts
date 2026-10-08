/**
 * @file The heading level of a card inside a chat message. The chat panel's own heading is an
 * `h2`, so a card's top heading is an `h3` and its sections follow at `h4` and below.
 * @module @caa/web/features/conversation/utils/chat-heading-level
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { HeadingLevel } from '@/shared/utils/heading-level';

/** The level of a card's top heading under the chat panel's `h2`. */
export const CHAT_CARD_LEVEL: HeadingLevel = 3;
