// The Quilt puzzle mechanics. Deliberately free of any canvas, DOM or pixel
// knowledge: geometry belongs to the renderer, so this stays unit-testable and
// the renderer stays swappable.

import type { Level, TileColor } from '/src/levelData.js';

export type ShiftDirection = 'up' | 'down' | 'left' | 'right';

/** What a shift actually moved — the renderer uses this to animate it. */
export interface ShiftResult {
  axis: 'row' | 'col';
  /** Which column (axis 'col') or row (axis 'row') moved. */
  index: number;
  /** +1 is down/right, -1 is up/left. */
  delta: -1 | 1;
}

/** Modulo that returns a non-negative result, unlike JS `%`. */
const wrap = (value: number, size: number): number => ((value % size) + size) % size;

export class TileSet {
  readonly #width: number;
  readonly #height: number;
  readonly #start: readonly TileColor[];
  readonly #goal: readonly TileColor[];
  #tiles: TileColor[];
  #selected = 0;

  constructor(level: Level) {
    const cells = level.width * level.height;
    if (!Number.isInteger(cells) || cells <= 0) {
      throw new Error(`TileSet: level has invalid dimensions ${level.width}x${level.height}`);
    }
    if (level.start?.length !== cells) {
      throw new Error(
        `TileSet: level start has ${level.start?.length ?? 0} cells, expected ${cells}`
      );
    }
    if (level.goal?.length !== cells) {
      throw new Error(
        `TileSet: level goal has ${level.goal?.length ?? 0} cells, expected ${cells}`
      );
    }

    this.#width = level.width;
    this.#height = level.height;
    this.#start = level.start;
    this.#goal = level.goal;
    this.#tiles = [...level.start];
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  /** Column-major: index = x * height + y. */
  get tiles(): readonly TileColor[] {
    return this.#tiles;
  }

  get goal(): readonly TileColor[] {
    return this.#goal;
  }

  get selected(): number {
    return this.#selected;
  }

  get selectedColumn(): number {
    return Math.floor(this.#selected / this.#height);
  }

  get selectedRow(): number {
    return this.#selected % this.#height;
  }

  get isSolved(): boolean {
    return this.#tiles.every((color, i) => color === this.#goal[i]);
  }

  /** Select by flat index. Returns false (leaving the selection alone) if out of range. */
  selectIndex(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.#tiles.length) {
      return false;
    }
    this.#selected = index;
    return true;
  }

  /** Select by grid coordinate — what the renderer calls after a tap. */
  selectCell(x: number, y: number): boolean {
    if (x < 0 || x >= this.#width || y < 0 || y >= this.#height) {
      return false;
    }
    return this.selectIndex(x * this.#height + y);
  }

  /** Move the pivot one cell, staying inside the board. Returns false if it couldn't. */
  moveSelection(direction: ShiftDirection): boolean {
    const height = this.#height;
    const selected = this.#selected;

    switch (direction) {
      case 'up':
        return selected % height !== 0 ? this.selectIndex(selected - 1) : false;
      case 'down':
        return selected % height !== height - 1 ? this.selectIndex(selected + 1) : false;
      case 'left':
        return selected >= height ? this.selectIndex(selected - height) : false;
      case 'right':
        return selected < this.#tiles.length - height ? this.selectIndex(selected + height) : false;
    }
  }

  /**
   * Cyclically shift the row or column under the selection. The selection index
   * itself never moves — the highlight stays on its cell while tiles slide
   * beneath it, matching the original game's feel.
   */
  shift(direction: ShiftDirection): ShiftResult {
    switch (direction) {
      case 'up': {
        const index = this.selectedColumn;
        this.#shiftColumn(index, -1);
        return { axis: 'col', index, delta: -1 };
      }
      case 'down': {
        const index = this.selectedColumn;
        this.#shiftColumn(index, 1);
        return { axis: 'col', index, delta: 1 };
      }
      case 'left': {
        const index = this.selectedRow;
        this.#shiftRow(index, -1);
        return { axis: 'row', index, delta: -1 };
      }
      case 'right': {
        const index = this.selectedRow;
        this.#shiftRow(index, 1);
        return { axis: 'row', index, delta: 1 };
      }
    }
  }

  reset(): void {
    this.#tiles = [...this.#start];
    this.#selected = 0;
  }

  #shiftColumn(column: number, delta: -1 | 1): void {
    const height = this.#height;
    const base = column * height;
    const before = this.#tiles.slice(base, base + height);

    for (let y = 0; y < height; y++) {
      this.#tiles[base + y] = before[wrap(y - delta, height)]!;
    }
  }

  #shiftRow(row: number, delta: -1 | 1): void {
    const width = this.#width;
    const height = this.#height;
    const before: TileColor[] = [];
    for (let x = 0; x < width; x++) {
      before.push(this.#tiles[x * height + row]!);
    }

    for (let x = 0; x < width; x++) {
      this.#tiles[x * height + row] = before[wrap(x - delta, width)]!;
    }
  }
}
