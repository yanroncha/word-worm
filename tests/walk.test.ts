import { describe, expect, it } from 'vitest';

import {
  FACES,
  N,
  WALK_PERIOD,
  allCells,
  cellOf,
  normalOf,
  posOf,
} from '../src/core/cube.js';
import type { Cursor } from '../src/core/walk.js';
import {
  cursorAt,
  directionsFrom,
  sameCursor,
  step,
  stepBack,
  walkPath,
} from '../src/core/walk.js';
import { equals, key } from '../src/core/vec.js';

/**
 * Runs `check` for every cell x every direction and collects the failures.
 * Asserting once on the collected list keeps these exhaustive sweeps fast and
 * reports the offending cell instead of just "expected true".
 */
function forEveryStart(check: (start: Cursor, label: string) => string | null): string[] {
  const problems: string[] = [];
  for (const cell of allCells()) {
    const pos = posOf(cell);
    for (const dir of directionsFrom(pos)) {
      const label = `${cell.face}(${cell.u},${cell.v}) dir ${dir.join(',')}`;
      const problem = check(cursorAt(pos, dir), label);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

describe('cell addressing', () => {
  it('covers 6 * 7 * 7 cells', () => {
    expect(allCells()).toHaveLength(6 * N * N);
  });

  it('round-trips Cell -> pos -> Cell for every cell', () => {
    for (const cell of allCells()) {
      expect(cellOf(posOf(cell))).toEqual(cell);
    }
  });

  it('gives every cell a distinct lattice position', () => {
    const seen = new Set(allCells().map((c) => key(posOf(c))));
    expect(seen.size).toBe(6 * N * N);
  });

  it('puts exactly one axis on the face plane', () => {
    for (const cell of allCells()) {
      const pos = posOf(cell);
      const onPlane = pos.filter((c) => Math.abs(c) === N);
      expect(onPlane).toHaveLength(1);
      expect(equals(normalOf(pos), FACES.find((f) => f.id === cell.face)!.n)).toBe(true);
    }
  });
});

describe('step across an edge', () => {
  it('moves within the face when there is room', () => {
    const start = cursorAt(posOf({ face: 'PZ', u: 2, v: 3 }), [1, 0, 0]);
    const next = step(start);
    expect(cellOf(next.pos)).toEqual({ face: 'PZ', u: 3, v: 3 });
    expect(next.normal).toEqual(start.normal);
    expect(next.dir).toEqual(start.dir);
  });

  it('rolls from the right edge of +Z onto the left edge of +X', () => {
    // Hand-derived: PZ(6,3) is at 2P = (6, 0, 7). Heading +X leaves the face, so
    // we land on +X at its left column, same row, now heading -Z (which is +X's
    // own "right").
    const start = cursorAt(posOf({ face: 'PZ', u: 6, v: 3 }), [1, 0, 0]);
    expect(start.pos).toEqual([6, 0, 7]);

    const next = step(start);
    expect(next.pos).toEqual([7, 0, 6]);
    expect(next.normal).toEqual([1, 0, 0]);
    expect(next.dir).toEqual([0, 0, -1]);
    expect(cellOf(next.pos)).toEqual({ face: 'PX', u: 0, v: 3 });
  });

  it('rolls from the top edge of +Z onto the near edge of +Y', () => {
    const start = cursorAt(posOf({ face: 'PZ', u: 3, v: 0 }), [0, 1, 0]);
    const next = step(start);
    expect(next.normal).toEqual([0, 1, 0]);
    expect(next.dir).toEqual([0, 0, -1]);
    expect(cellOf(next.pos)).toEqual({ face: 'PY', u: 3, v: 6 });
  });

  it('keeps every intermediate position on a real cell', () => {
    const problems = forEveryStart((start, label) => {
      let c = start;
      for (let i = 0; i < WALK_PERIOD; i++) {
        try {
          cellOf(c.pos);
        } catch (err) {
          return `${label} step ${i}: ${(err as Error).message}`;
        }
        c = step(c);
      }
      return null;
    });
    expect(problems).toEqual([]);
  });
});

describe('straight walks', () => {
  it('returns to the exact starting cursor after 28 steps, from anywhere', () => {
    const problems = forEveryStart((start, label) => {
      let c = start;
      for (let i = 0; i < WALK_PERIOD; i++) c = step(c);
      return sameCursor(c, start) ? null : `${label} did not close its lap`;
    });
    expect(problems).toEqual([]);
  });

  it('visits 28 distinct cells before repeating', () => {
    const problems = forEveryStart((start, label) => {
      const path = walkPath(start, WALK_PERIOD);
      const distinct = new Set(path.map((c) => key(c.pos))).size;
      return distinct === WALK_PERIOD ? null : `${label} visited only ${distinct} cells`;
    });
    expect(problems).toEqual([]);
  });

  it('crosses exactly four faces per lap', () => {
    const problems = forEveryStart((start, label) => {
      const path = walkPath(start, WALK_PERIOD);
      const faces = new Set(path.map((c) => cellOf(c.pos).face)).size;
      return faces === 4 ? null : `${label} touched ${faces} faces`;
    });
    expect(problems).toEqual([]);
  });

  it('refuses to walk further than one lap', () => {
    const start = cursorAt(posOf({ face: 'PZ', u: 3, v: 3 }), [1, 0, 0]);
    expect(() => walkPath(start, WALK_PERIOD + 1)).toThrow();
  });
});

describe('stepBack', () => {
  it('undoes step everywhere, including across edges', () => {
    for (const cell of allCells()) {
      const pos = posOf(cell);
      for (const dir of directionsFrom(pos)) {
        const start = cursorAt(pos, dir);
        expect(sameCursor(stepBack(step(start)), start)).toBe(true);
        expect(sameCursor(step(stepBack(start)), start)).toBe(true);
      }
    }
  });
});

describe('directions', () => {
  it('offers four in-plane directions per cell', () => {
    for (const cell of allCells()) {
      const dirs = directionsFrom(posOf(cell));
      expect(dirs).toHaveLength(4);
      expect(new Set(dirs.map(key)).size).toBe(4);
    }
  });

  it('rejects a direction that leaves the face plane', () => {
    expect(() => cursorAt(posOf({ face: 'PZ', u: 3, v: 3 }), [0, 0, 1])).toThrow();
  });
});
