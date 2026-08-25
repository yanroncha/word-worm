/**
 * Wires the game together: board logic, the two views, and the input handling
 * that connects them.
 *
 * A turn runs as: pick an anchor letter (double tap or press and hold) -> pick
 * one of the offered arrows (tap) -> type a word -> it either sticks or the
 * board flashes and the same player tries again.
 */

import * as THREE from 'three';

import type { Cell, CellPos, FaceId } from './core/cube.js';
import { face, normalOf, posOf } from './core/cube.js';
import { Game } from './core/game.js';
import { legalDirectionsFrom } from './core/rules.js';
import type { WordSource } from './core/rules.js';
import type { Vec3 } from './core/vec.js';
import { attachGestures } from './input/gestures.js';
import { OrbitDrag } from './input/orbitDrag.js';
import { Arrows } from './render/arrows.js';
import { CameraMoves } from './render/cameraMoves.js';
import { CubeMesh } from './render/cubeMesh.js';
import { NetView } from './render/netView.js';
import { Scene3D } from './render/scene.js';
import { Effects } from './ui/effects.js';
import { Hud } from './ui/hud.js';
import { ResultScreen } from './ui/resultScreen.js';
import { UI } from './ui/strings.js';
import { WordInput } from './ui/wordInput.js';

function need<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element #${id}`);
  return element as T;
}

export class App {
  private game: Game;

  private readonly scene: Scene3D;
  private readonly cube = new CubeMesh();
  private readonly arrows = new Arrows();
  private readonly moves: CameraMoves;
  private readonly orbit: OrbitDrag;
  private readonly net: NetView;
  private readonly netCanvas: HTMLCanvasElement;
  private readonly cubeCanvas: HTMLCanvasElement;

  private readonly hud: Hud;
  private readonly entry: WordInput;
  private readonly result: ResultScreen;
  private readonly effects: Effects;

  private readonly raycaster = new THREE.Raycaster();

  private anchor: CellPos | null = null;
  private direction: Vec3 | null = null;
  private netShown = false;
  private clock = 0;

  constructor(private readonly dictionary: WordSource) {
    this.cubeCanvas = need<HTMLCanvasElement>('cube');
    this.netCanvas = need<HTMLCanvasElement>('net');

    this.scene = new Scene3D(this.cubeCanvas);
    this.scene.root.add(this.cube.group);
    this.scene.root.add(this.arrows.group);
    this.moves = new CameraMoves(this.scene.root);
    this.orbit = new OrbitDrag(this.scene.root);
    this.net = new NetView(this.netCanvas);

    this.effects = new Effects(need('cross'), need('message'));
    this.hud = new Hud({
      scoreP1: need('score-p1'),
      scoreP2: need('score-p2'),
      blockP1: need<HTMLElement>('score-p1').parentElement as HTMLElement,
      blockP2: need<HTMLElement>('score-p2').parentElement as HTMLElement,
      turn: need('turn'),
      giveUp: need<HTMLButtonElement>('give-up'),
      toggleNet: need<HTMLButtonElement>('toggle-net'),
    });
    this.entry = new WordInput({
      panel: need('entry'),
      form: need<HTMLFormElement>('entry-form'),
      hint: need('entry-hint'),
      input: need<HTMLInputElement>('entry-input'),
      cancel: need<HTMLButtonElement>('entry-cancel'),
    });
    this.result = new ResultScreen({
      panel: need('result'),
      winner: need('result-winner'),
      scores: need('result-scores'),
      words: need('result-words'),
      newGame: need<HTMLButtonElement>('result-new'),
    });

    this.game = new Game(dictionary);

    this.bindInput();
    this.scene.onFrame((dt) => this.frame(dt));
    // Watch the board area rather than the window: it also changes height when
    // the word entry bar slides in and out, and the cube has to refit for that.
    new ResizeObserver(() => this.scene.resize()).observe(need('stage'));
  }

  start(): void {
    this.beginGame();
    this.scene.start();
  }

  // ---------------------------------------------------------------- game flow

  private beginGame(): void {
    this.game = new Game(this.dictionary);
    this.clearSelection();
    this.entry.close();
    this.result.hide();
    this.hud.update(this.game);
    this.effects.flashSeed(this.game.board.seedCell);
    this.effects.message(UI.seedAppeared);
    this.moves.faceTowards(normalOf(this.game.board.seedCell));
  }

  private selectAnchor(cell: Cell): void {
    if (this.game.isOver) return;
    const pos = posOf(cell);
    if (!this.game.board.isOccupied(pos)) {
      this.effects.message(UI.failure('ANCHOR_EMPTY'), 'error');
      return;
    }

    const directions = legalDirectionsFrom(this.game.board, pos);
    if (directions.length === 0) {
      // Both crossing words already use this letter, or there is no room behind.
      this.effects.message(UI.failure('NOT_PERPENDICULAR'), 'error');
      return;
    }

    this.anchor = pos;
    this.direction = null;
    this.entry.close();
    this.effects.setSelection(pos);
    this.effects.message(UI.pickDirection);
    this.arrows.show(pos, directions);
  }

  private chooseDirection(dir: Vec3): void {
    if (!this.anchor) return;
    this.direction = dir;
    this.arrows.hide();
    const letter = this.game.board.letterAt(this.anchor);
    if (letter) {
      this.entry.open(letter);
      this.effects.message(UI.enterWord(letter));
    }
  }

  private submitWord(text: string): void {
    if (!this.anchor || !this.direction) return;
    const anchor = this.anchor;

    const { result, word } = this.game.submit(anchor, this.direction, text);
    if (!result.ok) {
      this.effects.flashError(anchor);
      this.effects.message(UI.failure(result.reason), 'error');
      this.entry.reopen();
      return;
    }

    this.entry.close();
    this.clearSelection();
    this.hud.update(this.game);
    if (word) {
      this.effects.message(UI.wordPlayed(word.player, word.text));
      this.moves.revealWord(word.path);
      if (this.netShown) this.showNet(false);
    }
  }

  private giveUp(): void {
    if (this.game.isOver) return;
    const passer = this.game.current;
    this.game.giveUp();
    this.clearSelection();
    this.entry.close();
    this.hud.update(this.game);

    if (this.game.isOver) {
      this.result.show(this.game);
      this.effects.message('');
      return;
    }
    this.effects.message(`${UI.gaveUp(passer)} ${UI.onePassLeft}`);
  }

  private clearSelection(): void {
    this.anchor = null;
    this.direction = null;
    this.arrows.hide();
    this.effects.setSelection(null);
  }

  // ------------------------------------------------------------------- input

  private bindInput(): void {
    attachGestures(this.cubeCanvas, {
      onDragStart: () => {
        this.orbit.stop();
        this.moves.cancel();
      },
      onDrag: (dx, dy) => this.orbit.drag(dx, dy),
      onTap: (x, y) => this.onTap(x, y),
      onDoubleTap: (x, y) => this.onPick(x, y),
      onLongPress: (x, y) => this.onPick(x, y),
    });

    this.netCanvas.addEventListener('click', (event) => {
      const cell = this.net.hitTest(event.clientX, event.clientY);
      if (!cell) return;
      // Bring that face round to the front and hand control back to the cube,
      // which is where selecting happens.
      this.moves.faceTowards(face(cell.face as FaceId).n);
      this.showNet(false);
    });

    this.hud.onGiveUp(() => this.giveUp());
    this.hud.onToggleNet(() => this.showNet(!this.netShown));
    this.entry.onSubmit((text) => this.submitWord(text));
    this.entry.onCancel(() => {
      this.entry.close();
      this.clearSelection();
      this.effects.message(UI.seedAppeared);
    });
    this.result.onNewGame(() => this.beginGame());
  }

  private onTap(clientX: number, clientY: number): void {
    this.aimRay(clientX, clientY);
    const dir = this.arrows.pick(this.raycaster);
    if (dir) {
      this.chooseDirection(dir);
      return;
    }
    // A tap on bare cube while an anchor is live means "never mind".
    if (this.anchor && !this.entry.isOpen) {
      this.clearSelection();
      this.effects.message(UI.seedAppeared);
    }
  }

  private onPick(clientX: number, clientY: number): void {
    this.aimRay(clientX, clientY);
    // An arrow sitting over the cube should still win a long press.
    const dir = this.arrows.pick(this.raycaster);
    if (dir) {
      this.chooseDirection(dir);
      return;
    }
    const cell = this.cube.pick(this.raycaster);
    if (cell) this.selectAnchor(cell);
  }

  private aimRay(clientX: number, clientY: number): void {
    this.raycaster.setFromCamera(this.scene.toNdc(clientX, clientY), this.scene.camera);
  }

  private showNet(shown: boolean): void {
    this.netShown = shown;
    this.netCanvas.hidden = !shown;
    this.cubeCanvas.hidden = shown;
    this.hud.setNetShown(shown);
    if (!shown) this.scene.resize();
  }

  // -------------------------------------------------------------- frame loop

  private frame(dt: number): void {
    this.clock += dt;

    this.orbit.update(dt);
    this.moves.update(dt);
    this.effects.update(dt);
    this.arrows.update(this.clock);

    const highlights = this.effects.highlights();
    this.cube.update(this.game.board, highlights);
    if (this.netShown) this.net.render(this.game.board, highlights);
  }
}
