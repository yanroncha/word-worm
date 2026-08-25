/**
 * Turns the Board into per-face drawing data.
 *
 * Both renderers -- the cube's face textures and the flat net -- consume this,
 * so a word looks the same in either view.
 *
 * Word outlines are worked out per cell rather than per word: a cell draws a
 * thick edge on any side where no word running through it continues. That way a
 * word crossing onto another face just stops drawing at the boundary and picks
 * up again on the next face, with no special casing.
 */

import type { Board } from '../core/board.js';
import type { CellPos, FaceId } from '../core/cube.js';
import { N, face, posOf } from '../core/cube.js';
import type { PlayerId } from '../core/types.js';
import { key } from '../core/vec.js';
import { cursorAt, step } from '../core/walk.js';

export type Fill = PlayerId | 'shared' | 'seed';

export interface CellView {
  readonly u: number;
  readonly v: number;
  readonly letter: string;
  readonly fill: Fill;
  /** Sides that need a thick word outline, in face-local terms. */
  readonly borders: {
    readonly top: boolean;
    readonly right: boolean;
    readonly bottom: boolean;
    readonly left: boolean;
  };
  /** 0..1 blink strength, for the selected anchor or an error flash. */
  readonly highlight: number;
}

export interface FaceView {
  readonly face: FaceId;
  readonly cells: readonly CellView[];
}

/** Blink strengths by cell key; anything absent is drawn plain. */
export type Highlights = ReadonlyMap<string, number>;

export const NO_HIGHLIGHTS: Highlights = new Map();

export function faceView(board: Board, faceId: FaceId, highlights: Highlights = NO_HIGHLIGHTS): FaceView {
  const f = face(faceId);
  const cells: CellView[] = [];

  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      const pos = posOf({ face: faceId, u, v });
      const state = board.stateAt(pos);
      if (!state) continue;

      const ownership = board.ownershipAt(pos);
      cells.push({
        u,
        v,
        letter: state.letter,
        fill: ownership === null ? 'seed' : ownership,
        borders: {
          right: !continuesInto(board, pos, f.r),
          top: !continuesInto(board, pos, f.p),
          left: !continuesInto(board, pos, [-f.r[0], -f.r[1], -f.r[2]]),
          bottom: !continuesInto(board, pos, [-f.p[0], -f.p[1], -f.p[2]]),
        },
        highlight: highlights.get(key(pos)) ?? 0,
      });
    }
  }

  return { face: faceId, cells };
}

/** True when some word through `pos` carries on into the neighbouring cell. */
function continuesInto(board: Board, pos: CellPos, dir: readonly [number, number, number]): boolean {
  const neighbour = key(step(cursorAt(pos, dir)).pos);
  for (const word of board.wordsThrough(pos)) {
    const index = word.path.findIndex((c) => key(c.pos) === key(pos));
    if (index === -1) continue;
    const before = word.path[index - 1];
    const after = word.path[index + 1];
    if (before && key(before.pos) === neighbour) return true;
    if (after && key(after.pos) === neighbour) return true;
  }
  return false;
}
