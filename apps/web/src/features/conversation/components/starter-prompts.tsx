/**
 * @file The empty-chat state: one sentence and fixed starter questions as buttons. A button only
 * fills the message box and moves focus there; it never sends.
 * @module @caa/web/features/conversation/components/starter-prompts
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { EMPTY_CHAT_INTRO, STARTER_PROMPTS } from '../utils/conversation-wording';

/** Props for {@link StarterPrompts}. */
export interface StarterPromptsProps {
  /** Called with the chosen prompt's text. */
  readonly onChoose: (text: string) => void;
}

/**
 * Renders the intro sentence and the prompt buttons.
 *
 * @param props - The choose handler.
 * @returns The empty state.
 */
export function StarterPrompts({ onChoose }: StarterPromptsProps): ReactElement {
  return (
    <div className="chat-starters">
      <p id="chat-starters-intro">{EMPTY_CHAT_INTRO}</p>
      <ul aria-labelledby="chat-starters-intro" className="chat-starter-list">
        {STARTER_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => {
                onChoose(prompt);
              }}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
