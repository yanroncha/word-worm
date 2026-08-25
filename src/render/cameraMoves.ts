/**
 * Turns the cube on its own, so the player is shown what just happened.
 *
 * A word that wraps an edge is never fully visible from one angle, so after a
 * placement the cube rolls until the average of the faces the word crosses
 * points at the camera. For a word on one face that squares it up; for a word
 * spanning two faces it settles on the edge between them, showing both halves.
 */

import * as THREE from 'three';

import type { Vec3 } from '../core/vec.js';
import type { Cursor } from '../core/walk.js';

const TOWARDS_CAMERA = new THREE.Vector3(0, 0, 1);

/**
 * Settling dead-on would make the cube look like a flat grid. This much extra
 * turn keeps two neighbouring faces in view, so it still reads as a solid,
 * while the face of interest stays comfortably the one being read.
 */
const PRESENTATION_TILT = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-0.26, 0.36, 0, 'YXZ'),
);

export class CameraMoves {
  private target: THREE.Quaternion | null = null;

  constructor(private readonly root: THREE.Object3D) {}

  /** Roll until `normal` (in the cube's own frame) faces the viewer. */
  faceTowards(normal: Vec3): void {
    const from = new THREE.Vector3(...normal).normalize();
    const square = new THREE.Quaternion().setFromUnitVectors(from, TOWARDS_CAMERA);
    this.target = square.premultiply(PRESENTATION_TILT);
  }

  /** Show a whole word, however many faces it crosses. */
  revealWord(path: readonly Cursor[]): void {
    const mean = new THREE.Vector3();
    const seen = new Set<string>();
    for (const cursor of path) {
      const k = cursor.normal.join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      mean.add(new THREE.Vector3(...cursor.normal));
    }
    if (mean.lengthSq() === 0) return;
    this.faceTowards([mean.x, mean.y, mean.z]);
  }

  /** Any drag by the player wins over an animation in progress. */
  cancel(): void {
    this.target = null;
  }

  get isAnimating(): boolean {
    return this.target !== null;
  }

  update(dtSeconds: number): void {
    if (!this.target) return;
    // Frame-rate independent easing: cover the same fraction per unit of time.
    const t = 1 - Math.exp(-dtSeconds * 7);
    this.root.quaternion.slerp(this.target, t);
    if (this.root.quaternion.angleTo(this.target) < 0.002) {
      this.root.quaternion.copy(this.target);
      this.target = null;
    }
  }
}
