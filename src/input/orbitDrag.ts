/**
 * Free rotation of the cube by dragging.
 *
 * Rotations are applied about the camera's own axes and pre-multiplied onto the
 * cube's orientation, so a drag always turns the cube the way the player pushed
 * it regardless of how it is already sitting. There is no up vector to gimbal
 * lock, which is what "rotate in every direction" needs.
 */

import * as THREE from 'three';

const RADIANS_PER_PIXEL = 0.0075;
/** Fraction of the spin that survives each second after release. */
const SPIN_RETENTION = 0.02;
const SPIN_CUTOFF = 0.0004;

const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);
const SCREEN_UP = new THREE.Vector3(0, 1, 0);

export class OrbitDrag {
  private velocityX = 0;
  private velocityY = 0;

  constructor(private readonly target: THREE.Object3D) {}

  drag(dx: number, dy: number): void {
    this.apply(dx * RADIANS_PER_PIXEL, dy * RADIANS_PER_PIXEL);
    // Remember the latest motion so the cube keeps drifting when let go.
    this.velocityX = dx * RADIANS_PER_PIXEL;
    this.velocityY = dy * RADIANS_PER_PIXEL;
  }

  /** Called on pointer-down: a fresh grab stops the previous spin. */
  stop(): void {
    this.velocityX = 0;
    this.velocityY = 0;
  }

  update(dtSeconds: number): void {
    if (this.velocityX === 0 && this.velocityY === 0) return;
    this.apply(this.velocityX, this.velocityY);
    const decay = Math.pow(SPIN_RETENTION, dtSeconds);
    this.velocityX *= decay;
    this.velocityY *= decay;
    if (Math.hypot(this.velocityX, this.velocityY) < SPIN_CUTOFF) this.stop();
  }

  private apply(yaw: number, pitch: number): void {
    const rotation = new THREE.Quaternion()
      .setFromAxisAngle(SCREEN_UP, yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(SCREEN_RIGHT, pitch));
    this.target.quaternion.premultiply(rotation).normalize();
  }
}
