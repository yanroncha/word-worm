import type { CellPos } from './cube.js';
import type { Cursor } from './walk.js';

export type PlayerId = 'P1' | 'P2';

export const PLAYERS: readonly PlayerId[] = ['P1', 'P2'];

export const other = (p: PlayerId): PlayerId => (p === 'P1' ? 'P2' : 'P1');

/** A word that has been stuck onto the cube. */
export interface PlacedWord {
  readonly id: number;
  readonly text: string;
  readonly player: PlayerId;
  /** One cursor per letter: position, face and heading. `path[i]` holds `text[i]`. */
  readonly path: readonly Cursor[];
  /** Indices into `text` whose cell was already occupied, i.e. crossings. */
  readonly sharedIndices: readonly number[];
  /** 1-based turn number on which it was played. */
  readonly turn: number;
}

export interface CellState {
  readonly letter: string;
  /** Ids of every word running through this cell; length > 1 means a crossing. */
  readonly wordIds: number[];
  /** True for the single starting letter, which belongs to no word. */
  readonly isSeed: boolean;
}

/** Why a submitted word could not be placed. */
export type FailReason =
  | 'INVALID_CHARS'
  | 'BAD_LENGTH'
  | 'NOT_A_WORD'
  | 'ALREADY_USED'
  | 'ANCHOR_EMPTY'
  | 'ANCHOR_MISMATCH'
  | 'NOT_PERPENDICULAR'
  | 'HEAD_COLLISION'
  | 'BLOCKED'
  | 'TAIL_COLLISION';

export interface PlacementSuccess {
  readonly ok: true;
  readonly text: string;
  readonly path: readonly Cursor[];
  readonly sharedIndices: readonly number[];
}

export interface PlacementFailure {
  readonly ok: false;
  readonly reason: FailReason;
  /** Index into the submitted word where it went wrong, when that is meaningful. */
  readonly at?: CellPos;
}

export type PlacementResult = PlacementSuccess | PlacementFailure;
