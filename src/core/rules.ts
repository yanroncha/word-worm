/**
 * The single place that decides whether a submitted word may be stuck onto the
 * cube. Both the UI and the tests go through `validatePlacement`, so there is
 * only one definition of "legal" in the game.
 *
 * The rules, in the order they are checked:
 *
 *   1. The input is letters only, 3..27 of them.
 *   2. The word is in the dictionary and has not been played before.
 *   3. Its first letter is the anchor letter -- the anchor is shared, and the
 *      arrow the player picked is the reading direction.
 *   4. That direction is perpendicular to every word already through the anchor.
 *   5. The cell one step *before* the anchor is empty, and the cell one step
 *      *after* the last letter is empty. This is "must stop before it runs into
 *      another word": without it, two words would sit end to end on one line and
 *      read as a single run of letters.
 *   6. Every cell in between is either empty, or holds the same letter as part of
 *      a word crossing at a right angle. Same letter but running along the same
 *      line is an overlap, not a crossing, and is refused.
 *
 * Words running parallel and adjacent to each other are allowed.
 */

import type { CellPos } from './cube.js';
import { WALK_PERIOD } from './cube.js';
import type { Board } from './board.js';
import type { PlacementResult } from './types.js';
import type { Vec3 } from './vec.js';
import { dot } from './vec.js';
import type { Cursor } from './walk.js';
import { cursorAt, directionsFrom, isCollinear, step, stepBack, walkPath } from './walk.js';

export const MIN_WORD_LENGTH = 3;

/**
 * A straight walk returns to its start after WALK_PERIOD cells, so 27 is the
 * longest word that can exist without overlapping itself. At exactly 27 the
 * "cell before" and "cell after" are the same single free cell, which is
 * consistent; at 28 the trailing cell would be the anchor itself.
 */
export const MAX_WORD_LENGTH = WALK_PERIOD - 1;

/** Anything that can answer "is this a playable word?". */
export interface WordSource {
  has(word: string): boolean;
}

export function normalizeInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * The directions a player may extend in from a given cell: those perpendicular
 * to every word already passing through it, with a free cell behind them. The
 * seed letter belongs to no word, so all four of its directions qualify.
 */
export function legalDirectionsFrom(board: Board, anchor: CellPos): Vec3[] {
  if (!board.isOccupied(anchor)) return [];
  const words = board.wordsThrough(anchor);
  const candidates: Vec3[] = [];
  for (const dir of directionsFrom(anchor)) {
    if (!isPerpendicularToAll(board, anchor, dir, words)) continue;
    if (board.isOccupied(stepBack(cursorAt(anchor, dir)).pos)) continue;
    candidates.push(dir);
  }
  return candidates;
}

function isPerpendicularToAll(
  board: Board,
  anchor: CellPos,
  dir: Vec3,
  words: ReturnType<Board['wordsThrough']>,
): boolean {
  for (const word of words) {
    const heading = board.headingOfWordAt(word, anchor);
    if (!heading) continue;
    if (dot(heading, dir) !== 0) return false;
  }
  return true;
}

export function validatePlacement(
  board: Board,
  dictionary: WordSource,
  anchor: CellPos,
  dir: Vec3,
  raw: string,
): PlacementResult {
  const text = normalizeInput(raw);

  if (!/^[a-z]*$/.test(text)) return { ok: false, reason: 'INVALID_CHARS' };
  if (text.length < MIN_WORD_LENGTH || text.length > MAX_WORD_LENGTH) {
    return { ok: false, reason: 'BAD_LENGTH' };
  }
  if (!dictionary.has(text)) return { ok: false, reason: 'NOT_A_WORD' };
  if (board.hasWord(text)) return { ok: false, reason: 'ALREADY_USED' };

  const anchorState = board.stateAt(anchor);
  if (!anchorState) return { ok: false, reason: 'ANCHOR_EMPTY' };
  if (anchorState.letter !== text[0]) return { ok: false, reason: 'ANCHOR_MISMATCH', at: anchor };

  const start = cursorAt(anchor, dir);

  if (!isPerpendicularToAll(board, anchor, dir, board.wordsThrough(anchor))) {
    return { ok: false, reason: 'NOT_PERPENDICULAR', at: anchor };
  }

  const behind = stepBack(start).pos;
  if (board.isOccupied(behind)) return { ok: false, reason: 'HEAD_COLLISION', at: behind };

  const path = walkPath(start, text.length);

  for (let i = 1; i < path.length; i++) {
    const cursor = path[i] as Cursor;
    const state = board.stateAt(cursor.pos);
    if (!state) continue;
    if (state.letter !== text[i]) {
      return { ok: false, reason: 'BLOCKED', at: cursor.pos };
    }
    // Same letter is only a crossing if what is already there runs across us.
    for (const word of board.wordsThrough(cursor.pos)) {
      const heading = board.headingOfWordAt(word, cursor.pos);
      if (heading && isCollinear(heading, cursor.dir)) {
        return { ok: false, reason: 'BLOCKED', at: cursor.pos };
      }
    }
  }

  const last = path[path.length - 1] as Cursor;
  const ahead = step(last).pos;
  if (board.isOccupied(ahead)) return { ok: false, reason: 'TAIL_COLLISION', at: ahead };

  const sharedIndices = path
    .map((cursor, i) => (board.isOccupied(cursor.pos) ? i : -1))
    .filter((i) => i >= 0);

  return { ok: true, text, path, sharedIndices };
}
