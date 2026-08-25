/**
 * Walking in a straight line across the cube surface, including around edges.
 *
 * A `Cursor` is a cell plus a heading: where we are (`pos`), which face we are
 * on (`normal`), and which way we are travelling (`dir`, always perpendicular
 * to `normal`).
 *
 * Because cell centres sit at integer offsets from the face centre while the
 * cube corners sit at half-integer offsets, a straight walk can never pass
 * through a corner. That removes the only ambiguous case, so `step` below is
 * total: every cursor has exactly one successor.
 */

import type { CellPos } from './cube.js';
import { MAX_OFFSET, WALK_PERIOD, directionsOn, normalOf } from './cube.js';
import type { Vec3 } from './vec.js';
import { add, dot, equals, neg, scale, sub } from './vec.js';

export interface Cursor {
  readonly pos: CellPos;
  readonly normal: Vec3;
  readonly dir: Vec3;
}

export function cursorAt(pos: CellPos, dir: Vec3): Cursor {
  const normal = normalOf(pos);
  if (dot(normal, dir) !== 0) {
    throw new Error(`direction ${dir.join(',')} is not in the plane of ${normal.join(',')}`);
  }
  return { pos, normal, dir };
}

/** Advance one cell, rolling onto the neighbouring face when an edge is crossed. */
export function step(c: Cursor): Cursor {
  // Doubled coordinate along the direction of travel. Staying within
  // +-MAX_OFFSET means the next cell is still on the current face.
  if (Math.abs(dot(c.pos, c.dir) + 2) <= MAX_OFFSET) {
    return { pos: add(c.pos, scale(c.dir, 2)), normal: c.normal, dir: c.dir };
  }
  // Rolling over the edge: the face we were heading towards becomes the face we
  // are on, and the face we were on becomes what we are now heading away from.
  // Along `dir` the coordinate goes MAX_OFFSET -> FACE_COORD, and along
  // `normal` it goes FACE_COORD -> MAX_OFFSET. The third axis is untouched.
  return {
    pos: add(c.pos, sub(c.dir, c.normal)),
    normal: c.dir,
    dir: neg(c.normal),
  };
}

/** Same cell, opposite heading. */
export function reverse(c: Cursor): Cursor {
  return { pos: c.pos, normal: c.normal, dir: neg(c.dir) };
}

/** Retreat one cell, keeping the original heading. */
export function stepBack(c: Cursor): Cursor {
  return reverse(step(reverse(c)));
}

/** `length` consecutive cursors, starting at `start`. */
export function walkPath(start: Cursor, length: number): Cursor[] {
  if (length < 0) throw new Error(`negative walk length: ${length}`);
  if (length > WALK_PERIOD) {
    throw new Error(`walk of ${length} exceeds the ${WALK_PERIOD}-cell period of the cube`);
  }
  const path: Cursor[] = [];
  let c = start;
  for (let i = 0; i < length; i++) {
    path.push(c);
    c = step(c);
  }
  return path;
}

/** The four directions available from a cell, as right/up/left/down of its face. */
export function directionsFrom(pos: CellPos): Vec3[] {
  return directionsOn(normalOf(pos));
}

/** True when two cursors describe the same cell and heading. */
export function sameCursor(a: Cursor, b: Cursor): boolean {
  return equals(a.pos, b.pos) && equals(a.normal, b.normal) && equals(a.dir, b.dir);
}

/**
 * True when two headings lie on the same line (same or opposite). Used to tell a
 * legal crossing (perpendicular) from an illegal overlap (collinear).
 */
export function isCollinear(a: Vec3, b: Vec3): boolean {
  return equals(a, b) || equals(a, neg(b));
}
