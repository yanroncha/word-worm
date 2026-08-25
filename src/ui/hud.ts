/** The top bar: both scores, whose turn it is, and the two buttons. */

import type { Game } from '../core/game.js';
import { UI } from './strings.js';

export interface HudElements {
  readonly scoreP1: HTMLElement;
  readonly scoreP2: HTMLElement;
  readonly blockP1: HTMLElement;
  readonly blockP2: HTMLElement;
  readonly turn: HTMLElement;
  readonly giveUp: HTMLButtonElement;
  readonly toggleNet: HTMLButtonElement;
}

export class Hud {
  constructor(private readonly el: HudElements) {}

  onGiveUp(handler: () => void): void {
    this.el.giveUp.addEventListener('click', handler);
  }

  onToggleNet(handler: () => void): void {
    this.el.toggleNet.addEventListener('click', handler);
  }

  setNetShown(shown: boolean): void {
    this.el.toggleNet.textContent = shown ? UI.showCube : UI.showNet;
  }

  update(game: Game): void {
    this.el.scoreP1.textContent = String(game.scores.P1);
    this.el.scoreP2.textContent = String(game.scores.P2);
    this.el.blockP1.dataset.active = String(!game.isOver && game.current === 'P1');
    this.el.blockP2.dataset.active = String(!game.isOver && game.current === 'P2');
    this.el.turn.textContent = game.isOver ? UI.resultTitle : UI.turnOf(game.current);
    this.el.giveUp.disabled = game.isOver;
  }
}
