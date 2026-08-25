/**
 * The bar that slides up from the bottom once a direction has been chosen.
 *
 * No autocomplete and no suggestions: finding the word is the game.
 */

import { MAX_WORD_LENGTH } from '../core/rules.js';
import { UI } from './strings.js';

export interface WordInputElements {
  readonly panel: HTMLElement;
  readonly form: HTMLFormElement;
  readonly hint: HTMLElement;
  readonly input: HTMLInputElement;
  readonly cancel: HTMLButtonElement;
}

export class WordInput {
  private submitHandler: (text: string) => void = () => {};
  private cancelHandler: () => void = () => {};

  constructor(private readonly el: WordInputElements) {
    this.el.input.maxLength = MAX_WORD_LENGTH;

    this.el.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.el.input.value.trim();
      if (text) this.submitHandler(text);
    });

    this.el.cancel.addEventListener('click', () => this.cancelHandler());

    this.el.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelHandler();
      }
    });
  }

  onSubmit(handler: (text: string) => void): void {
    this.submitHandler = handler;
  }

  onCancel(handler: () => void): void {
    this.cancelHandler = handler;
  }

  get isOpen(): boolean {
    return !this.el.panel.hidden;
  }

  /** Opens with the anchor letter already filled in, cursor after it. */
  open(anchorLetter: string): void {
    this.el.hint.textContent = UI.enterWord(anchorLetter);
    this.el.panel.hidden = false;
    this.el.input.value = anchorLetter.toUpperCase();
    this.el.input.focus();
    this.el.input.setSelectionRange(1, 1);
  }

  close(): void {
    this.el.panel.hidden = true;
    this.el.input.value = '';
  }

  /** Keeps the bar open after a rejected word so the player can edit it. */
  reopen(): void {
    this.el.input.focus();
    this.el.input.select();
  }
}
