/**
 * The direction arrows shown beside a selected anchor letter.
 *
 * Only directions the player may actually use are drawn, so an illegal move can
 * never be started from here. Off the opening seed letter that is all four; off
 * a letter already inside a word it is the two perpendicular ones, minus any
 * whose word would immediately butt up against something.
 */

import * as THREE from 'three';

import type { CellPos } from '../core/cube.js';
import { cellOf, normalOf } from '../core/cube.js';
import type { Vec3 } from '../core/vec.js';
import { PALETTE } from './palette.js';
import { cellCentre } from './cubeMesh.js';

const CONE_UP = new THREE.Vector3(0, 1, 0);

export class Arrows {
  readonly group = new THREE.Group();
  private readonly cones: THREE.Mesh[] = [];

  constructor() {
    this.group.visible = false;
  }

  show(anchor: CellPos, directions: readonly Vec3[]): void {
    this.clear();

    const centre = cellCentre(cellOf(anchor));
    const normal = new THREE.Vector3(...normalOf(anchor));

    for (const dir of directions) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.6, 4),
        new THREE.MeshBasicMaterial({ color: PALETTE.selection }),
      );
      const heading = new THREE.Vector3(...dir);
      cone.quaternion.setFromUnitVectors(CONE_UP, heading);
      // Clear of the anchor letter, and clear of each other when all four show.
      cone.position
        .copy(centre)
        .addScaledVector(heading, 1.05)
        .addScaledVector(normal, 0.4);
      cone.userData.dir = dir;

      this.group.add(cone);
      this.cones.push(cone);
    }

    this.group.visible = this.cones.length > 0;
  }

  hide(): void {
    this.clear();
    this.group.visible = false;
  }

  get isVisible(): boolean {
    return this.group.visible;
  }

  /** The direction of the arrow under a ray, or null. */
  pick(raycaster: THREE.Raycaster): Vec3 | null {
    if (!this.group.visible) return null;
    const hit = raycaster.intersectObjects(this.cones, false)[0];
    return hit ? ((hit.object.userData.dir as Vec3) ?? null) : null;
  }

  /** A slow pulse, so the arrows read as "your move". */
  update(elapsedSeconds: number): void {
    if (!this.group.visible) return;
    const scale = 1 + Math.sin(elapsedSeconds * 5) * 0.12;
    for (const cone of this.cones) cone.scale.setScalar(scale);
  }

  private clear(): void {
    for (const cone of this.cones) {
      this.group.remove(cone);
      cone.geometry.dispose();
      (cone.material as THREE.Material).dispose();
    }
    this.cones.length = 0;
  }
}
