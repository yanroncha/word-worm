/**
 * The cube: six planes, each carrying a CanvasTexture painted by faceDraw.
 *
 * Six separate meshes rather than one box, because then a raycast hit tells us
 * the face directly and its uv tells us the cell, with no index arithmetic.
 *
 * A face is only repainted when what it should show actually changes, so the
 * blinking animations cost one canvas redraw per frame rather than six.
 */

import * as THREE from 'three';

import type { Board } from '../core/board.js';
import type { Cell, FaceId } from '../core/cube.js';
import { FACES, N, posOf } from '../core/cube.js';
import type { Highlights } from './boardView.js';
import { NO_HIGHLIGHTS, faceView } from './boardView.js';
import { drawFace } from './faceDraw.js';
import { renderKey } from './renderKey.js';
import { CUBE_HALF } from './scene.js';

const TEXTURE_SIZE = 512;

interface FaceSlot {
  readonly id: FaceId;
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  /** null until the face has been painted at least once; an empty face's
   *  signature is the empty string, which must not count as "already drawn". */
  signature: string | null;
}

export class CubeMesh {
  readonly group = new THREE.Group();
  private readonly slots: FaceSlot[] = [];
  private lastKey: string | null = null;

  constructor() {
    for (const face of FACES) {
      const canvas = document.createElement('canvas');
      canvas.width = TEXTURE_SIZE;
      canvas.height = TEXTURE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas is unavailable');

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(N, N),
        new THREE.MeshLambertMaterial({ map: texture }),
      );
      // Orient the plane so its local +X follows the face's `r` and +Y its `p`.
      // CanvasTexture flips Y by default, which lines the canvas's top row up
      // with `p`, i.e. with row v = 0.
      const r = new THREE.Vector3(...face.r);
      const p = new THREE.Vector3(...face.p);
      const n = new THREE.Vector3(...face.n);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.makeBasis(r, p, n);
      mesh.matrix.setPosition(n.clone().multiplyScalar(CUBE_HALF));
      mesh.userData.face = face.id;

      this.group.add(mesh);
      this.slots.push({ id: face.id, mesh, canvas, ctx, texture, signature: null });
    }
  }

  get meshes(): THREE.Object3D[] {
    return this.slots.map((slot) => slot.mesh);
  }

  update(board: Board, highlights: Highlights = NO_HIGHLIGHTS): void {
    const stateKey = renderKey(board, highlights);
    if (stateKey === this.lastKey) return;
    this.lastKey = stateKey;

    for (const slot of this.slots) {
      const view = faceView(board, slot.id, highlights);
      const signature = view.cells
        .map(
          (c) =>
            `${c.u}${c.v}${c.letter}${c.fill}${c.highlight.toFixed(2)}` +
            `${+c.borders.top}${+c.borders.right}${+c.borders.bottom}${+c.borders.left}`,
        )
        .join('|');
      if (signature === slot.signature) continue;

      drawFace(slot.ctx, 0, 0, TEXTURE_SIZE, view);
      slot.texture.needsUpdate = true;
      slot.signature = signature;
    }
  }

  /** The cell under a ray, or null when the ray misses the cube. */
  pick(raycaster: THREE.Raycaster): Cell | null {
    const hits = raycaster.intersectObjects(this.meshes, false);
    const hit = hits[0];
    if (!hit?.uv) return null;
    const face = hit.object.userData.face as FaceId;
    return {
      face,
      u: Math.min(N - 1, Math.floor(hit.uv.x * N)),
      // uv.y runs bottom-to-top; our rows run top-to-bottom.
      v: Math.min(N - 1, Math.floor((1 - hit.uv.y) * N)),
    };
  }
}

/** World-space centre of a cell, in the cube's own (unrotated) frame. */
export function cellCentre(cell: Cell): THREE.Vector3 {
  const pos = posOf(cell);
  // Lattice coordinates are doubled, and one unit of lattice is one cell.
  return new THREE.Vector3(pos[0] / 2, pos[1] / 2, pos[2] / 2);
}
