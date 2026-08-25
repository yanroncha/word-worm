/**
 * Turn order, scoring and end of game. Wraps a Board and a dictionary.
 *
 * Scoring is the full length of each word played, crossings included, matching
 * "the player with more letters stuck on wins".
 */

import { Board, CENTRE } from './board.js';
import type { FaceId } from './cube.js';
import { FACE_IDS } from './cube.js';
import type { CellPos } from './cube.js';
import type { WordSource } from './rules.js';
import { validatePlacement } from './rules.js';
import type { PlacedWord, PlacementResult, PlayerId } from './types.js';
import { other } from './types.js';
import type { Vec3 } from './vec.js';

export type GamePhase = 'playing' | 'over';

/**
 * Letters the opening tile may show, repeated in rough proportion to how many
 * English words begin with them. Keeps the first player from being handed a
 * letter almost nothing starts with.
 */
const SEED_LETTER_POOL =
  'aaaabbbcccccdddeeeffgghhiiijkllmmmnnooopppprrrsssssttttuuvwwy';

export interface GameOptions {
  /** Injected for tests and replays; defaults to Math.random. */
  readonly rng?: () => number;
  /** Force the opening letter instead of drawing one. */
  readonly seedLetter?: string;
  /** Force the opening face instead of drawing one. */
  readonly seedFace?: FaceId;
}

export interface SubmitOutcome {
  readonly result: PlacementResult;
  /** Present only when the placement succeeded. */
  readonly word?: PlacedWord;
}

export class Game {
  readonly board = new Board();
  readonly scores: Record<PlayerId, number> = { P1: 0, P2: 0 };

  private readonly dictionary: WordSource;
  private readonly rng: () => number;

  current: PlayerId = 'P1';
  phase: GamePhase = 'playing';
  turn = 1;
  consecutiveGiveUps = 0;

  constructor(dictionary: WordSource, options: GameOptions = {}) {
    this.dictionary = dictionary;
    this.rng = options.rng ?? Math.random;

    const face = options.seedFace ?? this.pick(FACE_IDS);
    const letter = options.seedLetter ?? this.pick([...SEED_LETTER_POOL]);
    this.board.seed({ face, u: CENTRE, v: CENTRE }, letter);
  }

  private pick<T>(items: readonly T[]): T {
    const index = Math.floor(this.rng() * items.length);
    return items[Math.min(index, items.length - 1)] as T;
  }

  /**
   * Attempts a placement. On success the word is committed, the score updated
   * and the turn passed. On failure nothing changes and the same player retries.
   */
  submit(anchor: CellPos, dir: Vec3, raw: string): SubmitOutcome {
    if (this.phase === 'over') {
      return { result: { ok: false, reason: 'ANCHOR_EMPTY' } };
    }

    const result = validatePlacement(this.board, this.dictionary, anchor, dir, raw);
    if (!result.ok) return { result };

    const word = this.board.place(
      result.text,
      this.current,
      result.path,
      result.sharedIndices,
      this.turn,
    );
    this.scores[this.current] += result.text.length;
    this.consecutiveGiveUps = 0;
    this.turn++;
    this.current = other(this.current);
    return { result, word };
  }

  /** Passes the turn. Two in a row ends the game. */
  giveUp(): void {
    if (this.phase === 'over') return;
    this.consecutiveGiveUps++;
    if (this.consecutiveGiveUps >= 2) {
      this.phase = 'over';
      return;
    }
    this.current = other(this.current);
  }

  get isOver(): boolean {
    return this.phase === 'over';
  }

  /** Null while the game is still running. */
  get winner(): PlayerId | 'draw' | null {
    if (this.phase !== 'over') return null;
    if (this.scores.P1 === this.scores.P2) return 'draw';
    return this.scores.P1 > this.scores.P2 ? 'P1' : 'P2';
  }
}
