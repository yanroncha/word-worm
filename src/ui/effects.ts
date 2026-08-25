/**
 * Transient feedback: the blinking anchor, the opening letter's flashes, the
 * big X on a rejected word, and the status line.
 *
 * Blink timing lives here and is published as a Highlights map, which both the
 * cube textures and the net view read, so the two blink in step.
 */

import type { CellPos } from '../core/cube.js';
import type { Highlights } from '../render/boardView.js';
import { key } from '../core/vec.js';

const SEED_FLASH_SECONDS = 1.9;
const SEED_FLASH_HZ = 3.2;
const ERROR_FLASH_SECONDS = 1.4;
const ERROR_FLASH_HZ = 5;
const CROSS_SECONDS = 1.2;
const MESSAGE_SECONDS = 5;

export class Effects {
  private selection: CellPos | null = null;
  private selectionClock = 0;

  private flashPos: CellPos | null = null;
  private flashRemaining = 0;
  private flashHz = SEED_FLASH_HZ;
  private flashClock = 0;

  private crossTimer = 0;
  private messageTimer = 0;

  constructor(
    private readonly crossElement: HTMLElement,
    private readonly messageElement: HTMLElement,
  ) {}

  setSelection(pos: CellPos | null): void {
    this.selection = pos;
    this.selectionClock = 0;
  }

  /** The opening letter announcing itself. */
  flashSeed(pos: CellPos): void {
    this.flashPos = pos;
    this.flashRemaining = SEED_FLASH_SECONDS;
    this.flashHz = SEED_FLASH_HZ;
    this.flashClock = 0;
  }

  /** A rejected word: the anchor blinks and a big X crosses the board. */
  flashError(pos: CellPos): void {
    this.flashPos = pos;
    this.flashRemaining = ERROR_FLASH_SECONDS;
    this.flashHz = ERROR_FLASH_HZ;
    this.flashClock = 0;
    this.showCross();
  }

  /**
   * The status line clears itself after a few seconds. It sits over the board,
   * and in the unfolded view it would otherwise cover the bottom face.
   */
  message(text: string, tone: 'info' | 'error' = 'info'): void {
    this.messageElement.textContent = text;
    this.messageElement.dataset.tone = tone;
    this.messageTimer = text ? MESSAGE_SECONDS : 0;
  }

  update(dtSeconds: number): void {
    this.selectionClock += dtSeconds;

    if (this.flashRemaining > 0) {
      this.flashClock += dtSeconds;
      this.flashRemaining -= dtSeconds;
      if (this.flashRemaining <= 0) {
        this.flashRemaining = 0;
        this.flashPos = null;
      }
    }

    if (this.crossTimer > 0) {
      this.crossTimer -= dtSeconds;
      if (this.crossTimer <= 0) {
        this.crossTimer = 0;
        delete this.crossElement.dataset.on;
      }
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dtSeconds;
      if (this.messageTimer <= 0) {
        this.messageTimer = 0;
        this.messageElement.textContent = '';
      }
    }
  }

  highlights(): Highlights {
    const map = new Map<string, number>();

    if (this.selection) {
      // A steady glow with a slow breath, so it reads as "selected" rather than
      // as an error.
      map.set(key(this.selection), 0.45 + 0.25 * Math.sin(this.selectionClock * 4));
    }

    if (this.flashPos && this.flashRemaining > 0) {
      const on = Math.sin(this.flashClock * Math.PI * 2 * this.flashHz) > 0 ? 1 : 0;
      if (on) map.set(key(this.flashPos), 1);
      else map.delete(key(this.flashPos));
    }

    return map;
  }

  private showCross(): void {
    // Re-trigger the CSS animation even if one is already running.
    delete this.crossElement.dataset.on;
    void this.crossElement.offsetWidth;
    this.crossElement.dataset.on = 'true';
    this.crossTimer = CROSS_SECONDS;
  }
}
