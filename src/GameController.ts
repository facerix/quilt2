// Game state machine. Replaces the old `tangle/stateManager` and the input
// switchboard in `js/main.js`.
//
// Deliberately DOM-free: it owns level progression and emits snapshots, and the
// page decides how to draw them. That keeps the rules testable and stops the
// controller from hardcoding element ids the way the original did.

import { TileSet } from '/src/TileSet.js';
import type { ShiftDirection, ShiftResult } from '/src/TileSet.js';
import type { Level } from '/src/levelData.js';

export type GameState = 'play' | 'cleared' | 'win';

export interface GameSnapshot {
  state: GameState;
  levelIndex: number;
  /** 1-based, for display. */
  levelNumber: number;
  levelCount: number;
  moves: number;
  tileSet: TileSet;
  /** A display-only TileSet showing the target pattern. */
  goalSet: TileSet;
}

export interface GameControllerOptions {
  levels: readonly Level[];
  /** Called when a level is solved — used to persist progress. */
  onSolve?: (levelIndex: number, moves: number) => void;
  /** How long the CLEARED banner lingers before the next level. */
  clearedDelayMs?: number;
  /** Injectable timer, so tests never wait on the clock. */
  schedule?: (callback: () => void, delayMs: number) => number;
  cancel?: (handle: number) => void;
}

const DEFAULT_CLEARED_DELAY_MS = 1600;

export class GameController extends EventTarget {
  readonly #levels: readonly Level[];
  readonly #onSolve: ((levelIndex: number, moves: number) => void) | undefined;
  readonly #clearedDelayMs: number;
  readonly #schedule: (callback: () => void, delayMs: number) => number;
  readonly #cancel: (handle: number) => void;

  #levelIndex = 0;
  #state: GameState = 'play';
  #moves = 0;
  #tileSet: TileSet;
  #goalSet: TileSet;
  #pending: number | null = null;

  constructor(options: GameControllerOptions) {
    super();

    if (!options.levels || options.levels.length === 0) {
      throw new Error('GameController: no levels were provided');
    }

    this.#levels = options.levels;
    this.#onSolve = options.onSolve;
    this.#clearedDelayMs = options.clearedDelayMs ?? DEFAULT_CLEARED_DELAY_MS;
    this.#schedule =
      options.schedule ??
      ((callback, delayMs) => setTimeout(callback, delayMs) as unknown as number);
    this.#cancel = options.cancel ?? (handle => clearTimeout(handle));

    const { tileSet, goalSet } = this.#buildLevel(0);
    this.#tileSet = tileSet;
    this.#goalSet = goalSet;
  }

  get snapshot(): GameSnapshot {
    return {
      state: this.#state,
      levelIndex: this.#levelIndex,
      levelNumber: this.#levelIndex + 1,
      levelCount: this.#levels.length,
      moves: this.#moves,
      tileSet: this.#tileSet,
      goalSet: this.#goalSet,
    };
  }

  /** Begin play, optionally resuming at a level. Out-of-range resumes start over. */
  start(levelIndex = 0): void {
    const index =
      Number.isInteger(levelIndex) && levelIndex >= 0 && levelIndex < this.#levels.length
        ? levelIndex
        : 0;

    this.#cancelPending();
    this.#loadLevel(index);
    this.#state = 'play';
    this.#emitChange();
  }

  moveSelection(direction: ShiftDirection): boolean {
    if (this.#state !== 'play') return false;

    const moved = this.#tileSet.moveSelection(direction);
    if (moved) this.#emitChange();
    return moved;
  }

  selectCell(x: number, y: number): boolean {
    if (this.#state !== 'play') return false;

    const selected = this.#tileSet.selectCell(x, y);
    if (selected) this.#emitChange();
    return selected;
  }

  shift(direction: ShiftDirection): ShiftResult | null {
    if (this.#state !== 'play') return null;

    const result = this.#tileSet.shift(direction);
    this.#moves += 1;

    // `change` first so listeners settle the board on its new tiles, then
    // `shift` so the animation that follows isn't immediately cancelled.
    this.#emitChange();
    this.dispatchEvent(new CustomEvent<ShiftResult>('shift', { detail: result }));

    if (this.#tileSet.isSolved) {
      this.#handleSolved();
    }
    return result;
  }

  restart(): void {
    if (this.#state !== 'play') return;

    this.#tileSet.reset();
    this.#moves = 0;
    this.#emitChange();
  }

  /** Drop any scheduled level advance — call when tearing the game down. */
  dispose(): void {
    this.#cancelPending();
  }

  #handleSolved(): void {
    this.#onSolve?.(this.#levelIndex, this.#moves);

    const isLastLevel = this.#levelIndex >= this.#levels.length - 1;
    if (isLastLevel) {
      this.#state = 'win';
      this.#emitChange();
      return;
    }

    this.#state = 'cleared';
    this.#emitChange();

    this.#pending = this.#schedule(() => {
      this.#pending = null;
      this.#loadLevel(this.#levelIndex + 1);
      this.#state = 'play';
      this.#emitChange();
    }, this.#clearedDelayMs);
  }

  #buildLevel(index: number): { tileSet: TileSet; goalSet: TileSet } {
    const level = this.#levels[index]!;
    return {
      tileSet: new TileSet(level),
      // The preview is a board whose starting position *is* the goal.
      goalSet: new TileSet({ ...level, start: level.goal }),
    };
  }

  #loadLevel(index: number): void {
    const { tileSet, goalSet } = this.#buildLevel(index);
    this.#levelIndex = index;
    this.#tileSet = tileSet;
    this.#goalSet = goalSet;
    this.#moves = 0;
  }

  #cancelPending(): void {
    if (this.#pending !== null) {
      this.#cancel(this.#pending);
      this.#pending = null;
    }
  }

  #emitChange(): void {
    this.dispatchEvent(new CustomEvent<GameSnapshot>('change', { detail: this.snapshot }));
  }
}
