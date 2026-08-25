/**
 * The board: which letter sits on which cell, and which words run through it.
 *
 * Pure data. Knows nothing about turns, scoring or rendering.
 */

import type { Cell, CellPos } from './cube.js';
import { N, allCells, cellOf, posOf } from './cube.js';
import type { CellState, PlacedWord, PlayerId } from './types.js';
import { key } from './vec.js';
import type { Cursor } from './walk.js';

/** The centre cell of a 7x7 face, where the starting letter appears. */
export const CENTRE = (N - 1) / 2;

export class Board {
  private readonly cells = new Map<string, CellState>();
  private readonly words: PlacedWord[] = [];
  private readonly usedText = new Set<string>();
  private seedPos: CellPos | null = null;
  private nextWordId = 1;
  private revision = 0;

  /** Bumped whenever anything on the board changes; renderers use it to skip work. */
  get version(): number {
    return this.revision;
  }

  /** Places the starting letter at the centre of a face. Only valid once. */
  seed(cell: Cell, letter: string): void {
    if (this.seedPos) throw new Error('board already seeded');
    const pos = posOf(cell);
    this.cells.set(key(pos), { letter, wordIds: [], isSeed: true });
    this.seedPos = pos;
    this.revision++;
  }

  get seedCell(): CellPos {
    if (!this.seedPos) throw new Error('board not seeded');
    return this.seedPos;
  }

  stateAt(pos: CellPos): CellState | undefined {
    return this.cells.get(key(pos));
  }

  letterAt(pos: CellPos): string | undefined {
    return this.cells.get(key(pos))?.letter;
  }

  isOccupied(pos: CellPos): boolean {
    return this.cells.has(key(pos));
  }

  /** True once two or more words share this cell, or it is the seed under a word. */
  isShared(pos: CellPos): boolean {
    const state = this.cells.get(key(pos));
    if (!state) return false;
    return state.wordIds.length > 1 || (state.isSeed && state.wordIds.length > 0);
  }

  hasWord(text: string): boolean {
    return this.usedText.has(text);
  }

  get allWords(): readonly PlacedWord[] {
    return this.words;
  }

  wordById(id: number): PlacedWord | undefined {
    return this.words.find((w) => w.id === id);
  }

  /** Every word passing through a cell, in play order. */
  wordsThrough(pos: CellPos): PlacedWord[] {
    const state = this.cells.get(key(pos));
    if (!state) return [];
    return state.wordIds
      .map((id) => this.wordById(id))
      .filter((w): w is PlacedWord => w !== undefined);
  }

  /** The heading a given word has as it passes through a cell. */
  headingOfWordAt(word: PlacedWord, pos: CellPos): Cursor['dir'] | undefined {
    const k = key(pos);
    return word.path.find((c) => key(c.pos) === k)?.dir;
  }

  /** Commits a validated placement and returns the stored word. */
  place(
    text: string,
    player: PlayerId,
    path: readonly Cursor[],
    sharedIndices: readonly number[],
    turn: number,
  ): PlacedWord {
    const word: PlacedWord = {
      id: this.nextWordId++,
      text,
      player,
      path,
      sharedIndices,
      turn,
    };

    path.forEach((cursor, i) => {
      const k = key(cursor.pos);
      const letter = text[i] as string;
      const existing = this.cells.get(k);
      if (existing) {
        existing.wordIds.push(word.id);
      } else {
        this.cells.set(k, { letter, wordIds: [word.id], isSeed: false });
      }
    });

    this.words.push(word);
    this.usedText.add(text);
    this.revision++;
    return word;
  }

  /** Snapshot for renderers: every occupied cell, addressed by face and (u, v). */
  occupiedCells(): Array<{ cell: Cell; pos: CellPos; state: CellState }> {
    const out: Array<{ cell: Cell; pos: CellPos; state: CellState }> = [];
    for (const cell of allCells()) {
      const pos = posOf(cell);
      const state = this.cells.get(key(pos));
      if (state) out.push({ cell, pos, state });
    }
    return out;
  }

  /** The owner colour class for a cell: a player, a crossing, or the seed. */
  ownershipAt(pos: CellPos): PlayerId | 'shared' | 'seed' | null {
    const state = this.cells.get(key(pos));
    if (!state) return null;
    if (this.isShared(pos)) return 'shared';
    if (state.isSeed) return 'seed';
    const first = state.wordIds[0];
    if (first === undefined) return null;
    return this.wordById(first)?.player ?? null;
  }

  /** Convenience for tests and debugging. */
  describeCell(pos: CellPos): string {
    const cell = cellOf(pos);
    const state = this.stateAt(pos);
    return `${cell.face}(${cell.u},${cell.v})=${state ? state.letter : '.'}`;
  }
}
