/**
 * Three.js plumbing: renderer, camera, lights and the render loop.
 *
 * The cube itself lives under `root`, which is what the drag handler rotates.
 * Nothing here knows about the game.
 */

import * as THREE from 'three';

export const CUBE_HALF = 3.5;

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Everything that turns with the cube. */
  readonly root = new THREE.Group();

  private readonly frameCallbacks: Array<(dtSeconds: number) => void> = [];
  private lastFrame = 0;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0, 17);

    // The main light sits where the camera is, so every face turned towards the
    // viewer is lit in proportion to how squarely it faces them. Letters stay
    // readable on all three visible faces while the falloff still reads as a
    // solid; a light off to one side would leave a face in the dark.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const front = new THREE.DirectionalLight(0xffffff, 0.4);
    front.position.set(0, 0, 1);
    this.scene.add(front);
    const shaper = new THREE.DirectionalLight(0xffffff, 0.22);
    shaper.position.set(5, 7, 4);
    this.scene.add(shaper);

    // A gentle starting tilt so three faces are visible straight away.
    this.root.quaternion.setFromEuler(new THREE.Euler(-0.35, 0.55, 0));
    this.scene.add(this.root);

    this.resize();
  }

  onFrame(callback: (dtSeconds: number) => void): void {
    this.frameCallbacks.push(callback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      for (const callback of this.frameCallbacks) callback(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.position.z = this.fittingDistance();
    this.camera.updateProjectionMatrix();
  }

  /**
   * Far enough back that the cube stays fully in shot however it is turned.
   *
   * Framing is against the widest silhouette the cube can present -- face-on it
   * is a square of circumradius 3.5*sqrt(2), corner-on a hexagon slightly
   * smaller than that -- and against whichever field of view is the tighter,
   * which on a narrow phone screen is the horizontal one.
   */
  private fittingDistance(): number {
    const radius = CUBE_HALF * Math.SQRT2 * 1.18; // widest silhouette, plus margin
    const halfV = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    return radius / Math.sin(Math.min(halfV, halfH));
  }

  /** Pointer position in normalised device coordinates, for raycasting. */
  toNdc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }
}
