/**
 * Integer 3D vector helpers.
 *
 * Every position on the cube surface is stored in "doubled" coordinates so that
 * all components stay integers (see cube.ts for why half-integers would appear
 * otherwise). Nothing in this module knows about the cube itself.
 */

export type Vec3 = readonly [number, number, number];

/**
 * Collapse -0 to 0. Negating or scaling a zero component otherwise yields -0,
 * which compares equal with === but not with deep-equality checks, and which
 * would produce two different string keys for the same cell.
 */
const nz = (x: number): number => (x === 0 ? 0 : x);

export const add = (a: Vec3, b: Vec3): Vec3 => [
  nz(a[0] + b[0]),
  nz(a[1] + b[1]),
  nz(a[2] + b[2]),
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  nz(a[0] - b[0]),
  nz(a[1] - b[1]),
  nz(a[2] - b[2]),
];
export const neg = (a: Vec3): Vec3 => [nz(-a[0]), nz(-a[1]), nz(-a[2])];
export const scale = (a: Vec3, k: number): Vec3 => [nz(a[0] * k), nz(a[1] * k), nz(a[2] * k)];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  nz(a[1] * b[2] - a[2] * b[1]),
  nz(a[2] * b[0] - a[0] * b[2]),
  nz(a[0] * b[1] - a[1] * b[0]),
];

export const equals = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Stable string key for use in Map/Set. Only valid for integer vectors. */
export const key = (a: Vec3): string => `${a[0]},${a[1]},${a[2]}`;

export const fromKey = (k: string): Vec3 => {
  const parts = k.split(',');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
};

/** The six unit axis vectors, used as face normals and travel directions. */
export const AXES: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
