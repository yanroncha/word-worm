/**
 * Draws one 7x7 face onto a 2D canvas context.
 *
 * Used twice: to paint the six CanvasTextures glued to the cube, and to paint
 * the same six faces side by side in the unfolded net view.
 */

import { N } from '../core/cube.js';
import type { CellView, FaceView } from './boardView.js';
import { PALETTE } from './palette.js';

const FILL_COLOURS = {
  P1: PALETTE.p1Fill,
  P2: PALETTE.p2Fill,
  shared: PALETTE.sharedFill,
  seed: PALETTE.seedFill,
} as const;

export interface DrawFaceOptions {
  /** Thickness of the word outline, as a fraction of one cell. */
  readonly borderRatio?: number;
  /** Draw the pale grid of empty cells. */
  readonly grid?: boolean;
}

export function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  view: FaceView,
  options: DrawFaceOptions = {},
): void {
  const cell = size / N;
  const borderWidth = Math.max(2, cell * (options.borderRatio ?? 0.09));

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = PALETTE.faceEmpty;
  ctx.fillRect(0, 0, size, size);

  if (options.grid !== false) {
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = Math.max(1, cell * 0.02);
    ctx.beginPath();
    for (let i = 1; i < N; i++) {
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
    }
    ctx.stroke();
  }

  for (const c of view.cells) fillCell(ctx, c, cell);
  for (const c of view.cells) drawLetter(ctx, c, cell);
  for (const c of view.cells) drawBorders(ctx, c, cell, borderWidth);
  for (const c of view.cells) drawHighlight(ctx, c, cell);

  ctx.strokeStyle = PALETTE.faceEdge;
  ctx.lineWidth = Math.max(2, cell * 0.06);
  ctx.strokeRect(0, 0, size, size);

  ctx.restore();
}

function fillCell(ctx: CanvasRenderingContext2D, c: CellView, cell: number): void {
  ctx.fillStyle = FILL_COLOURS[c.fill];
  ctx.fillRect(c.u * cell, c.v * cell, cell, cell);
}

function drawLetter(ctx: CanvasRenderingContext2D, c: CellView, cell: number): void {
  ctx.fillStyle = c.fill === 'seed' ? PALETTE.seedLetter : PALETTE.letter;
  ctx.font = `700 ${Math.round(cell * 0.62)}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Nudged down slightly: optical centring beats metric centring for capitals.
  ctx.fillText(c.letter.toUpperCase(), (c.u + 0.5) * cell, (c.v + 0.54) * cell);
}

function drawBorders(
  ctx: CanvasRenderingContext2D,
  c: CellView,
  cell: number,
  width: number,
): void {
  const left = c.u * cell;
  const top = c.v * cell;
  const right = left + cell;
  const bottom = top + cell;

  ctx.strokeStyle = PALETTE.wordBorder;
  ctx.lineWidth = width;
  ctx.lineCap = 'square';
  ctx.beginPath();
  if (c.borders.top) {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
  }
  if (c.borders.bottom) {
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, bottom);
  }
  if (c.borders.left) {
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
  }
  if (c.borders.right) {
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
  }
  ctx.stroke();
}

function drawHighlight(ctx: CanvasRenderingContext2D, c: CellView, cell: number): void {
  if (c.highlight <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, c.highlight) * 0.8;
  ctx.fillStyle = PALETTE.selection;
  ctx.fillRect(c.u * cell, c.v * cell, cell, cell);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.min(1, c.highlight);
  ctx.strokeStyle = PALETTE.selection;
  ctx.lineWidth = Math.max(2, cell * 0.12);
  ctx.strokeRect(c.u * cell, c.v * cell, cell, cell);
  ctx.restore();

  // The letter would otherwise be swamped by the highlight wash.
  drawLetter(ctx, c, cell);
}
