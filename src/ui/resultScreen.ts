/** The end screen: who won, both scores, every word played, and a rematch. */

import type { Game } from '../core/game.js';
import { PLAYERS } from '../core/types.js';
import { UI } from './strings.js';

export interface ResultElements {
  readonly panel: HTMLElement;
  readonly winner: HTMLElement;
  readonly scores: HTMLElement;
  readonly words: HTMLElement;
  readonly newGame: HTMLButtonElement;
}

export class ResultScreen {
  constructor(private readonly el: ResultElements) {}

  onNewGame(handler: () => void): void {
    this.el.newGame.addEventListener('click', handler);
  }

  hide(): void {
    this.el.panel.hidden = true;
  }

  show(game: Game): void {
    const winner = game.winner;
    this.el.winner.textContent =
      winner === null || winner === 'draw' ? UI.resultDraw : UI.resultWinner(winner);

    this.el.scores.replaceChildren(
      ...PLAYERS.map((player) => {
        const box = document.createElement('div');
        box.className = 'result__score';
        box.dataset.player = player;
        box.append(
          text('span', UI.playerName(player)),
          text('b', String(game.scores[player])),
          text('span', UI.letters(game.scores[player])),
        );
        return box;
      }),
    );

    const words = game.board.allWords;
    this.el.words.dataset.empty = String(words.length === 0);
    if (words.length === 0) {
      this.el.words.replaceChildren(text('li', UI.resultNoWords));
    } else {
      this.el.words.replaceChildren(
        ...words.map((word) => {
          const item = document.createElement('li');
          item.className = 'result__word';
          item.dataset.player = word.player;
          item.append(
            text('b', word.text),
            text('span', ` - ${UI.playerName(word.player)}, ${UI.letters(word.text.length)}`),
          );
          return item;
        }),
      );
    }

    this.el.panel.hidden = false;
  }
}

function text(tag: string, content: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}
