import { beforeEach, describe, expect, it } from 'vitest';

import { Board } from '../src/core/board.js';
import type { Cell } from '../src/core/cube.js';
import { cellOf, posOf } from '../src/core/cube.js';
import { Game } from '../src/core/game.js';
import { MAX_WORD_LENGTH, legalDirectionsFrom, validatePlacement } from '../src/core/rules.js';
import type { WordSource } from '../src/core/rules.js';
import type { PlayerId } from '../src/core/types.js';
import type { Vec3 } from '../src/core/vec.js';
import { cursorAt, walkPath } from '../src/core/walk.js';

/** In-plane directions of the +Z face, which every fixture below plays on. */
const RIGHT: Vec3 = [1, 0, 0];
const LEFT: Vec3 = [-1, 0, 0];
const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];

const WORDS = new Set([
  'cat',
  'cab',
  'cob',
  'bat',
  'tea',
  'tee',
  'tone',
  'toe',
  'ear',
  'ape',
  'pen',
  'tint',
  'net',
  'ant',
  'oat',
  'japan',
]);

const dictionary: WordSource = { has: (word) => WORDS.has(word) };

const pz = (u: number, v: number): Cell => ({ face: 'PZ', u, v });
const at = (u: number, v: number) => posOf(pz(u, v));

/**
 * Drops a word onto the board without validating it, so each test can build
 * exactly the position it needs. Mirrors what Board.place expects.
 */
function put(board: Board, from: Cell, dir: Vec3, text: string, player: PlayerId = 'P1') {
  const path = walkPath(cursorAt(posOf(from), dir), text.length);
  const shared = path.map((c, i) => (board.isOccupied(c.pos) ? i : -1)).filter((i) => i >= 0);
  return board.place(text, player, path, shared, board.allWords.length + 1);
}

function seeded(letter = 'c'): Board {
  const board = new Board();
  board.seed(pz(3, 3), letter);
  return board;
}

describe('input checks', () => {
  let board: Board;
  beforeEach(() => {
    board = seeded();
  });

  it('rejects non-letters', () => {
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, 'c4t');
    expect(r).toMatchObject({ ok: false, reason: 'INVALID_CHARS' });
  });

  it('rejects words shorter than three letters', () => {
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, 'ca');
    expect(r).toMatchObject({ ok: false, reason: 'BAD_LENGTH' });
  });

  it('rejects words longer than one lap of the cube', () => {
    const tooLong = 'c'.repeat(MAX_WORD_LENGTH + 1);
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, tooLong);
    expect(r).toMatchObject({ ok: false, reason: 'BAD_LENGTH' });
  });

  it('rejects words that are not in the dictionary', () => {
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, 'czq');
    expect(r).toMatchObject({ ok: false, reason: 'NOT_A_WORD' });
  });

  it('ignores case and surrounding space', () => {
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, '  CAT ');
    expect(r.ok).toBe(true);
  });

  it('refuses a word already on the board', () => {
    put(board, pz(3, 3), RIGHT, 'cat');
    const r = validatePlacement(board, dictionary, at(3, 1), RIGHT, 'cat');
    expect(r).toMatchObject({ ok: false, reason: 'ALREADY_USED' });
  });
});

describe('anchoring', () => {
  it('needs an occupied anchor', () => {
    const board = seeded();
    const r = validatePlacement(board, dictionary, at(0, 0), RIGHT, 'cat');
    expect(r).toMatchObject({ ok: false, reason: 'ANCHOR_EMPTY' });
  });

  it('needs the first letter to match the anchor letter', () => {
    const board = seeded('c');
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, 'bat');
    expect(r).toMatchObject({ ok: false, reason: 'ANCHOR_MISMATCH' });
  });

  it('accepts all four directions off the seed letter', () => {
    const board = seeded('c');
    for (const dir of [RIGHT, LEFT, UP, DOWN]) {
      expect(validatePlacement(board, dictionary, at(3, 3), dir, 'cat').ok).toBe(true);
    }
    expect(legalDirectionsFrom(board, at(3, 3))).toHaveLength(4);
  });

  it('refuses to extend along an existing word', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    const r = validatePlacement(board, dictionary, at(3, 3), RIGHT, 'cab');
    expect(r).toMatchObject({ ok: false, reason: 'NOT_PERPENDICULAR' });
  });

  it('offers only the two perpendicular directions once a word is in place', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    const dirs = legalDirectionsFrom(board, at(4, 3));
    expect(dirs).toHaveLength(2);
    expect(dirs).toEqual(expect.arrayContaining([UP, DOWN]));
  });
});

describe('running into other words', () => {
  it('refuses when the cell before the first letter is occupied', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    put(board, pz(2, 1), DOWN, 'bat');
    // Heading left from bat's 't' is perpendicular and legal in itself, but it
    // would leave the word sitting directly against cat's 'c'.
    const r = validatePlacement(board, dictionary, at(2, 3), LEFT, 'toe');
    expect(r).toMatchObject({ ok: false, reason: 'HEAD_COLLISION' });
  });

  it('refuses when the cell after the last letter is occupied', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    put(board, pz(4, 6), RIGHT, 'pen');
    // ape covers rows 3..5 of column 4; row 6 already holds the 'p' of pen.
    const r = validatePlacement(board, dictionary, at(4, 3), DOWN, 'ape');
    expect(r).toMatchObject({ ok: false, reason: 'TAIL_COLLISION' });
  });

  it('refuses when a letter in the way does not match', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    put(board, pz(2, 1), RIGHT, 'bat');
    // tee would need 'e' where cat already has its 'a'.
    const r = validatePlacement(board, dictionary, at(4, 1), DOWN, 'tee');
    expect(r).toMatchObject({ ok: false, reason: 'BLOCKED' });
  });

  it('refuses a matching letter that belongs to a word on the same line', () => {
    const board = seeded();
    put(board, pz(2, 1), RIGHT, 'bat');
    put(board, pz(4, 4), DOWN, 'ear');
    // tone ends on ear's 'e'. Same letter, but ear runs the same way we do, so
    // this is an overlap rather than a crossing.
    const r = validatePlacement(board, dictionary, at(4, 1), DOWN, 'tone');
    expect(r).toMatchObject({ ok: false, reason: 'BLOCKED' });
  });
});

describe('crossings', () => {
  it('lets a word cross a perpendicular word on a shared letter', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    put(board, pz(2, 1), RIGHT, 'bat');

    const r = validatePlacement(board, dictionary, at(4, 1), DOWN, 'tea');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Index 0 is the anchor, index 2 is where it crosses cat.
    expect(r.sharedIndices).toEqual([0, 2]);
    expect(r.path.map((c) => cellOf(c.pos))).toEqual([pz(4, 1), pz(4, 2), pz(4, 3)]);
  });

  it('marks crossed cells as shared once placed', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    put(board, pz(2, 1), RIGHT, 'bat');
    put(board, pz(4, 1), DOWN, 'tea', 'P2');

    expect(board.isShared(at(4, 3))).toBe(true);
    expect(board.ownershipAt(at(4, 3))).toBe('shared');
    expect(board.ownershipAt(at(5, 3))).toBe('P1');
    expect(board.wordsThrough(at(4, 3)).map((w) => w.text)).toEqual(['cat', 'tea']);
  });

  it('treats the seed letter as shared once a word runs through it', () => {
    const board = seeded();
    put(board, pz(3, 3), RIGHT, 'cat');
    expect(board.ownershipAt(at(3, 3))).toBe('shared');
  });
});

describe('wrapping around an edge', () => {
  it('continues onto the next face and reports the right cells', () => {
    const board = seeded();
    // A vertical word hard against the right edge of +Z, so heading right from
    // its last letter immediately runs off the face.
    put(board, pz(6, 1), DOWN, 'bat');

    const r = validatePlacement(board, dictionary, at(6, 3), RIGHT, 'tint');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.path.map((c) => cellOf(c.pos))).toEqual([
      { face: 'PZ', u: 6, v: 3 },
      { face: 'PX', u: 0, v: 3 },
      { face: 'PX', u: 1, v: 3 },
      { face: 'PX', u: 2, v: 3 },
    ]);
  });
});

describe('game flow', () => {
  const options = { seedFace: 'PZ', seedLetter: 'c', rng: () => 0 } as const;

  it('scores the whole word and passes the turn', () => {
    const game = new Game(dictionary, options);
    expect(game.current).toBe('P1');

    const { result } = game.submit(at(3, 3), RIGHT, 'cat');
    expect(result.ok).toBe(true);
    expect(game.scores).toEqual({ P1: 3, P2: 0 });
    expect(game.current).toBe('P2');
  });

  it('keeps the turn with the same player after an illegal word', () => {
    const game = new Game(dictionary, options);
    const { result } = game.submit(at(3, 3), RIGHT, 'zzz');
    expect(result.ok).toBe(false);
    expect(game.current).toBe('P1');
    expect(game.scores).toEqual({ P1: 0, P2: 0 });
  });

  it('counts shared letters for both players', () => {
    const game = new Game(dictionary, options);
    game.submit(at(3, 3), RIGHT, 'cat'); // P1: c a t  -> 3
    game.submit(at(4, 3), DOWN, 'ant'); // P2: a n t  -> 3, sharing the 'a'
    expect(game.scores).toEqual({ P1: 3, P2: 3 });
  });

  it('ends after two give-ups in a row and picks the winner', () => {
    const game = new Game(dictionary, options);
    game.submit(at(3, 3), RIGHT, 'cat');
    expect(game.current).toBe('P2');

    game.giveUp();
    expect(game.isOver).toBe(false);
    expect(game.current).toBe('P1');

    game.giveUp();
    expect(game.isOver).toBe(true);
    expect(game.winner).toBe('P1');
  });

  it('resets the give-up counter when someone plays', () => {
    const game = new Game(dictionary, options);
    game.giveUp();
    game.submit(at(3, 3), RIGHT, 'cat');
    expect(game.consecutiveGiveUps).toBe(0);
    game.giveUp();
    expect(game.isOver).toBe(false);
  });

  it('reports a draw when the scores are level', () => {
    const game = new Game(dictionary, options);
    game.submit(at(3, 3), RIGHT, 'cat');
    game.submit(at(4, 3), DOWN, 'ant');
    game.giveUp();
    game.giveUp();
    expect(game.winner).toBe('draw');
  });
});
