/**
 * The cube unfolded flat, as a cross.
 *
 *          +---------+
 *          |   PY    |
 *  +-------+---------+-------+-------+
 *  |  NX   |   PZ    |  PX   |  NZ   |
 *  +-------+---------+-------+-------+
 *          |   NY    |
 *          +---------+
 *
 * The four faces in the middle row are laid out in true walking order: stepping
 * off the right edge of PZ lands on the left edge of PX, and so on round to NX,
 * so a word that wraps an edge reads straight across this view. Likewise PY sits
 * directly above PZ and NY directly below.
 *
 * It exists so a player can see the whole board at once -- and, during
 * development, so board logic can be checked without trusting the 3D view.
 */

import type { Board } from '../core/board.js';
import type { Cell, FaceId } from '../core/cube.js';
import { N } from '../core/cube.js';
import type { Highlights } from './boardView.js';
import { NO_HIGHLIGHTS, faceView } from './boardView.js';
import { drawFace } from './faceDraw.js';
import { PALETTE } from './palette.js';
import { renderKey } from './renderKey.js';

interface Slot {
  readonly face: FaceId;
  readonly col: number;
  readonly row: number;
}

const LAYOUT: readonly Slot[] = [
  { face: 'PY', col: 1, row: 0 },
  { face: 'NX', col: 0, row: 1 },
  { face: 'PZ', col: 1, row: 1 },
  { face: 'PX', col: 2, row: 1 },
  { face: 'NZ', col: 3, row: 1 },
  { face: 'NY', col: 1, row: 2 },
];

const COLS = 4;
const ROWS = 3;
/** Wide enough to fit the face labels between the faces. */
const GAP_RATIO = 0.15;

export class NetView {
  private faceSize = 0;
  private originX = 0;
  private originY = 0;
  private gap = 0;
  private lastKey: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(board: Board, highlights: Highlights = NO_HIGHLIGHTS): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;

    // The canvas size is part of the key: a resize has to redraw even when the
    // board has not moved.
    const stateKey = renderKey(board, highlights, `${cssWidth}x${cssHeight}@${dpr}`);
    if (stateKey === this.lastKey) return;
    this.lastKey = stateKey;

    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fit the 4x3 arrangement, gaps included, inside the canvas. The vertical
    // budget carries one extra gap so the top row's caption has somewhere to go.
    const unitW = COLS + (COLS - 1) * GAP_RATIO;
    const unitH = ROWS + ROWS * GAP_RATIO;
    this.faceSize = Math.floor(Math.min(cssWidth / unitW, cssHeight / unitH));
    this.gap = this.faceSize * GAP_RATIO;
    const totalW = COLS * this.faceSize + (COLS - 1) * this.gap;
    const totalH = ROWS * this.faceSize + (ROWS - 1) * this.gap;
    this.originX = (cssWidth - totalW) / 2;
    this.originY = Math.max(this.gap, (cssHeight - totalH) / 2);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    for (const slot of LAYOUT) {
      const { x, y } = this.slotOrigin(slot);
      drawFace(ctx, x, y, this.faceSize, faceView(board, slot.face, highlights), {
        borderRatio: 0.11,
      });
      this.drawLabel(ctx, slot, x, y);
    }
  }

  /** Which cell, if any, sits under a point given in client coordinates. */
  hitTest(clientX: number, clientY: number): Cell | null {
    if (this.faceSize === 0) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (const slot of LAYOUT) {
      const origin = this.slotOrigin(slot);
      const dx = x - origin.x;
      const dy = y - origin.y;
      if (dx < 0 || dy < 0 || dx >= this.faceSize || dy >= this.faceSize) continue;
      const cellSize = this.faceSize / N;
      return {
        face: slot.face,
        u: Math.min(N - 1, Math.floor(dx / cellSize)),
        v: Math.min(N - 1, Math.floor(dy / cellSize)),
      };
    }
    return null;
  }

  private slotOrigin(slot: Slot): { x: number; y: number } {
    return {
      x: this.originX + slot.col * (this.faceSize + this.gap),
      y: this.originY + slot.row * (this.faceSize + this.gap),
    };
  }

  private drawLabel(ctx: CanvasRenderingContext2D, slot: Slot, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.caption;
    ctx.globalAlpha = 0.75;
    ctx.font = `600 ${Math.round(this.faceSize * 0.085)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(FACE_LABELS[slot.face], x + 1, y - this.gap * 0.25);
    ctx.restore();
  }
}

const FACE_LABELS: Record<FaceId, string> = {
  PZ: 'front',
  PX: 'right',
  NZ: 'back',
  NX: 'left',
  PY: 'top',
  NY: 'bottom',
};
