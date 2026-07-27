/**
 * QuiltBoard Web Component
 * Draws a TileSet to a canvas and turns pointer gestures into game intents.
 *
 * Usage:
 *   const board = document.querySelector('quilt-board');
 *   board.setTileSet(tileSet);
 *   board.addEventListener('tile-select', evt => { ... evt.detail.x / .y });
 *   board.addEventListener('tile-shift', evt => { ... evt.detail.direction });
 *
 * Add the `readonly` attribute for a display-only board (the goal preview):
 * no selection ring, no input.
 *
 * Tile colors come from CSS custom properties on the host or an ancestor:
 *   --tile-0 … --tile-7, --board-bg, --board-border,
 *   --board-selection, --board-selection-outline
 */

import { h } from '/src/domUtils.js';
import { cellAtPoint, computeBoardLayout, selectionRingMetrics } from '/src/boardGeometry.js';
import { onPointerGesture } from '/src/gestures.js';
import type { BoardLayout } from '/src/boardGeometry.js';
import type { SwipeDirection } from '/src/gestures.js';
import type { ShiftResult, TileSet } from '/src/TileSet.js';
import type { TileColor } from '/src/levelData.js';

const PALETTE_SIZE = 8;
const SHIFT_DURATION_MS = 130;

/** Unmissable stand-in so a missing palette entry can't hide as a black tile. */
const MISSING_COLOR = '#ff00ff';

export interface TileSelectDetail {
  x: number;
  y: number;
}

export interface TileShiftDetail {
  direction: SwipeDirection;
  /** The cell the swipe started on, so the caller can pivot there first. */
  x: number;
  y: number;
}

const CSS = `
:host {
  display: block;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  /* Claim the gesture before the browser turns it into a scroll. */
  touch-action: none;
}

:host([readonly]) canvas {
  touch-action: auto;
}
`;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

class QuiltBoard extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #tileSet: TileSet | null = null;

  #palette: string[] = [];
  #boardBg = '#ffffff';
  #boardBorder = '#ffffff';
  #selectionColor = 'rgba(255, 255, 255, 0.95)';
  #selectionOutline = 'rgba(9, 12, 26, 0.75)';

  #cssWidth = 0;
  #cssHeight = 0;

  #resizeObserver: ResizeObserver | null = null;
  #detachGestures: (() => void) | null = null;
  #colorSchemeQuery: MediaQueryList | null = null;
  #animation: { result: ShiftResult; start: number } | null = null;
  #frame = 0;

  connectedCallback(): void {
    if (this.#canvas) return;

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(h('style', { textContent: CSS }));

    this.#canvas = h('canvas');
    shadow.appendChild(this.#canvas);
    this.#ctx = this.#canvas.getContext('2d');

    this.#readPalette();

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this);

    this.#colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.#colorSchemeQuery.addEventListener('change', this.#handleColorSchemeChange);

    if (!this.hasAttribute('readonly')) {
      this.#detachGestures = onPointerGesture(this.#canvas, {
        onTap: this.#handleTap,
        onSwipe: this.#handleSwipe,
      });
    }

    this.#resize();
  }

  disconnectedCallback(): void {
    this.#cancelAnimation();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#detachGestures?.();
    this.#detachGestures = null;
    this.#colorSchemeQuery?.removeEventListener('change', this.#handleColorSchemeChange);
    this.#colorSchemeQuery = null;
  }

  get isReadonly(): boolean {
    return this.hasAttribute('readonly');
  }

  setTileSet(tileSet: TileSet | null): void {
    this.#tileSet = tileSet;
    this.#cancelAnimation();
    this.render();
  }

  /** Re-read theme colors, e.g. after the page swaps its palette. */
  refreshPalette(): void {
    this.#readPalette();
    this.render();
  }

  /**
   * Slide the row or column that just moved into its new place. The model has
   * already been shifted, so the animation runs backwards from where the tiles
   * came, then settles at zero offset.
   */
  animateShift(result: ShiftResult): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.render();
      return;
    }

    this.#cancelAnimation();
    this.#animation = { result, start: performance.now() };
    this.#frame = requestAnimationFrame(this.#tick);
  }

  render(): void {
    const ctx = this.#ctx;
    const tileSet = this.#tileSet;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.#cssWidth, this.#cssHeight);
    if (!tileSet) return;

    const layout = this.#layout();
    if (layout.cell <= 0) return;

    ctx.fillStyle = this.#boardBg;
    ctx.fillRect(layout.originX, layout.originY, layout.width, layout.height);

    const animation = this.#animation;
    const progress = animation
      ? easeOutCubic(clamp01((performance.now() - animation.start) / SHIFT_DURATION_MS))
      : 1;
    // At progress 0 the moving line sits one cell back, where it came from.
    const slide = animation ? (1 - progress) * layout.cell * -animation.result.delta : 0;

    const { width, height } = tileSet;
    const tiles = tileSet.tiles;
    const movingIsColumn = animation?.result.axis === 'col';

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const isMoving =
          animation !== null &&
          (movingIsColumn ? x === animation.result.index : y === animation.result.index);
        if (isMoving) continue; // drawn below, with wrapping
        this.#drawTile(ctx, layout, x, y, tiles[x * height + y]!);
      }
    }

    if (animation) {
      // Draw the moving line three times — one cell-span behind, in place, and
      // ahead — clipped to the board. That makes the tile leaving one edge
      // appear at the opposite edge without any special-casing.
      ctx.save();
      ctx.beginPath();
      ctx.rect(layout.originX, layout.originY, layout.width, layout.height);
      ctx.clip();

      const count = movingIsColumn ? height : width;
      const span = count * layout.cell;

      for (let i = 0; i < count; i++) {
        const x = movingIsColumn ? animation.result.index : i;
        const y = movingIsColumn ? i : animation.result.index;
        const color = tiles[x * height + y]!;

        for (const wrapOffset of [-span, 0, span]) {
          const offset = slide + wrapOffset;
          this.#drawTile(
            ctx,
            layout,
            x,
            y,
            color,
            movingIsColumn ? 0 : offset,
            movingIsColumn ? offset : 0
          );
        }
      }
      ctx.restore();
    }

    if (!this.isReadonly) {
      this.#drawSelection(ctx, layout, tileSet);
    }

    ctx.strokeStyle = this.#boardBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(layout.originX + 0.5, layout.originY + 0.5, layout.width - 1, layout.height - 1);
  }

  #tick = (): void => {
    const animation = this.#animation;
    if (!animation) return;

    this.render();

    if (performance.now() - animation.start >= SHIFT_DURATION_MS) {
      this.#animation = null;
      this.render(); // settle on exact final positions
      return;
    }
    this.#frame = requestAnimationFrame(this.#tick);
  };

  #cancelAnimation(): void {
    if (this.#frame) {
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
    }
    this.#animation = null;
  }

  #layout(): BoardLayout {
    const tileSet = this.#tileSet;
    if (!tileSet) return { cell: 0, originX: 0, originY: 0, width: 0, height: 0 };
    return computeBoardLayout(this.#cssWidth, this.#cssHeight, tileSet.width, tileSet.height);
  }

  #drawTile(
    ctx: CanvasRenderingContext2D,
    layout: BoardLayout,
    x: number,
    y: number,
    color: TileColor,
    offsetX = 0,
    offsetY = 0
  ): void {
    const px = layout.originX + x * layout.cell + offsetX;
    const py = layout.originY + y * layout.cell + offsetY;

    ctx.fillStyle = this.#palette[color] ?? MISSING_COLOR;
    ctx.fillRect(px, py, layout.cell, layout.cell);

    ctx.strokeStyle = this.#boardBg;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, layout.cell - 1, layout.cell - 1);
  }

  #drawSelection(ctx: CanvasRenderingContext2D, layout: BoardLayout, tileSet: TileSet): void {
    const centerX = layout.originX + (tileSet.selectedColumn + 0.5) * layout.cell;
    const centerY = layout.originY + (tileSet.selectedRow + 0.5) * layout.cell;
    const { radius, haloWidth, ringWidth } = selectionRingMetrics(layout.cell);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    // Dark halo first, bright ring over it: one of the two contrasts whatever
    // tile color is underneath, including the near-white one.
    ctx.lineWidth = haloWidth;
    ctx.strokeStyle = this.#selectionOutline;
    ctx.stroke();

    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = this.#selectionColor;
    ctx.stroke();
  }

  #resize(): void {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.#cssWidth = rect.width;
    this.#cssHeight = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    // Draw in CSS pixels; the backing store carries the extra density.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }

  #readPalette(): void {
    const styles = getComputedStyle(this);
    const read = (name: string, fallback: string): string => {
      const value = styles.getPropertyValue(name).trim();
      if (!value) {
        console.error(`[quilt-board] missing CSS custom property ${name}`);
        return fallback;
      }
      return value;
    };

    this.#palette = Array.from({ length: PALETTE_SIZE }, (_, i) =>
      read(`--tile-${i}`, MISSING_COLOR)
    );
    this.#boardBg = read('--board-bg', MISSING_COLOR);
    this.#boardBorder = read('--board-border', MISSING_COLOR);
    this.#selectionColor = read('--board-selection', MISSING_COLOR);
    this.#selectionOutline = read('--board-selection-outline', MISSING_COLOR);
  }

  #handleColorSchemeChange = (): void => {
    this.refreshPalette();
  };

  #cellFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = this.#canvas;
    const tileSet = this.#tileSet;
    if (!canvas || !tileSet) return null;

    const rect = canvas.getBoundingClientRect();
    return cellAtPoint(
      this.#layout(),
      tileSet.width,
      tileSet.height,
      clientX - rect.left,
      clientY - rect.top
    );
  }

  #handleTap = (clientX: number, clientY: number): void => {
    const cell = this.#cellFromClient(clientX, clientY);
    if (!cell) return;
    this.dispatchEvent(
      new CustomEvent<TileSelectDetail>('tile-select', { detail: cell, bubbles: true })
    );
  };

  #handleSwipe = (direction: SwipeDirection, clientX: number, clientY: number): void => {
    const cell = this.#cellFromClient(clientX, clientY);
    if (!cell) return;
    this.dispatchEvent(
      new CustomEvent<TileShiftDetail>('tile-shift', {
        detail: { direction, ...cell },
        bubbles: true,
      })
    );
  };
}

customElements.define('quilt-board', QuiltBoard);

declare global {
  interface HTMLElementTagNameMap {
    'quilt-board': QuiltBoard;
  }
}

export default QuiltBoard;
