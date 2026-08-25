/**
 * The cube surface as a lattice of cells.
 *
 * A cell is addressed two ways:
 *
 *   - `Cell`      — human/render friendly: which face, and (u, v) within its 7x7 grid.
 *   - `CellPos`   — a 3D lattice vector, which is what the walking logic uses.
 *
 * The natural 3D form of a cell centre is
 *
 *     P = 3.5*n + (u-3)*r + (3-v)*p
 *
 * i.e. one axis is +-3.5 (that axis identifies the face) and the other two are
 * integers in [-3, 3]. To keep everything integral we store **2P** instead, so
 * one axis is +-7 and the other two are even numbers in [-6, 6]. Every cell has
 * exactly one such vector, which makes the vector itself a perfect map key.
 *
 * Working in 3D like this means there is no hand-written 24-entry edge adjacency
 * table to get wrong: crossing an edge is arithmetic (see walk.ts).
 */

import type { Vec3 } from './vec.js';
import { add, cross, dot, equals, scale } from './vec.js';

/** Cells per face edge. */
export const N = 7;

/** Doubled distance from cube centre to a face plane: 2 * 3.5. */
export const FACE_COORD = N;

/** Doubled maximum in-face offset from the face centre: 2 * 3. */
export const MAX_OFFSET = N - 1;

/** Number of cells a straight walk visits before returning to its start. */
export const WALK_PERIOD = 4 * N;

export type FaceId = 'PX' | 'NX' | 'PY' | 'NY' | 'PZ' | 'NZ';

export interface Face {
  readonly id: FaceId;
  /** Outward normal. */
  readonly n: Vec3;
  /** In-plane axis for increasing u (left to right). */
  readonly r: Vec3;
  /** In-plane axis for decreasing v (bottom to top). */
  readonly p: Vec3;
}

export interface Cell {
  readonly face: FaceId;
  /** Column, 0..6, left to right. */
  readonly u: number;
  /** Row, 0..6, top to bottom. */
  readonly v: number;
}

/** A cell centre in doubled lattice coordinates. */
export type CellPos = Vec3;

export const FACES: readonly Face[] = [
  { id: 'PX', n: [1, 0, 0], r: [0, 0, -1], p: [0, 1, 0] },
  { id: 'NX', n: [-1, 0, 0], r: [0, 0, 1], p: [0, 1, 0] },
  { id: 'PY', n: [0, 1, 0], r: [1, 0, 0], p: [0, 0, -1] },
  { id: 'NY', n: [0, -1, 0], r: [1, 0, 0], p: [0, 0, 1] },
  { id: 'PZ', n: [0, 0, 1], r: [1, 0, 0], p: [0, 1, 0] },
  { id: 'NZ', n: [0, 0, -1], r: [-1, 0, 0], p: [0, 1, 0] },
];

export const FACE_IDS: readonly FaceId[] = FACES.map((f) => f.id);

const FACE_BY_ID = new Map<FaceId, Face>(FACES.map((f) => [f.id, f]));

export function face(id: FaceId): Face {
  const f = FACE_BY_ID.get(id);
  if (!f) throw new Error(`unknown face: ${id}`);
  return f;
}

/** The face whose outward normal is `n`. */
export function faceByNormal(n: Vec3): Face {
  const f = FACES.find((candidate) => equals(candidate.n, n));
  if (!f) throw new Error(`not a face normal: ${n.join(',')}`);
  return f;
}

export function isInBounds(u: number, v: number): boolean {
  return Number.isInteger(u) && Number.isInteger(v) && u >= 0 && u < N && v >= 0 && v < N;
}

/** Cell -> doubled lattice position. */
export function posOf(cell: Cell): CellPos {
  if (!isInBounds(cell.u, cell.v)) {
    throw new Error(`cell out of bounds: ${cell.face} (${cell.u},${cell.v})`);
  }
  const f = face(cell.face);
  const half = (N - 1) / 2;
  return add(
    scale(f.n, FACE_COORD),
    add(scale(f.r, 2 * (cell.u - half)), scale(f.p, 2 * (half - cell.v))),
  );
}

/** The outward normal of the face a position sits on. */
export function normalOf(pos: CellPos): Vec3 {
  for (let axis = 0; axis < 3; axis++) {
    const c = pos[axis] as number;
    if (Math.abs(c) === FACE_COORD) {
      const n: [number, number, number] = [0, 0, 0];
      n[axis] = Math.sign(c);
      return n;
    }
  }
  throw new Error(`position is not on the cube surface: ${pos.join(',')}`);
}

/** Doubled lattice position -> Cell. */
export function cellOf(pos: CellPos): Cell {
  const f = faceByNormal(normalOf(pos));
  const half = (N - 1) / 2;
  const u = dot(pos, f.r) / 2 + half;
  const v = half - dot(pos, f.p) / 2;
  if (!isInBounds(u, v)) {
    throw new Error(`position maps outside a face: ${pos.join(',')}`);
  }
  return { face: f.id, u, v };
}

/** Every cell on the cube, in face order. */
export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (const f of FACES) {
    for (let v = 0; v < N; v++) {
      for (let u = 0; u < N; u++) cells.push({ face: f.id, u, v });
    }
  }
  return cells;
}

/**
 * The four in-plane travel directions available on the face with normal `n`,
 * ordered right, up, left, down relative to that face.
 */
export function directionsOn(n: Vec3): Vec3[] {
  const f = faceByNormal(n);
  return [f.r, f.p, scale(f.r, -1), scale(f.p, -1)];
}

/** True when `a` and `b` are perpendicular in-plane directions of the same face. */
export function isPerpendicular(a: Vec3, b: Vec3): boolean {
  return dot(a, b) === 0 && !equals(cross(a, b), [0, 0, 0]);
}
