/**
 * A cheap string that changes exactly when a board rendering would change.
 *
 * Both renderers run inside the frame loop, but the board only changes on a
 * move and the highlight map holds at most a cell or two. Comparing this key
 * lets a frame that would redraw the same thing bail out immediately.
 */

import type { Board } from '../core/board.js';
import type { Highlights } from './boardView.js';

export function renderKey(board: Board, highlights: Highlights, extra = ''): string {
  let lit = '';
  for (const [cell, strength] of highlights) lit += `${cell}:${strength.toFixed(2)};`;
  return `${board.version}|${lit}|${extra}`;
}
