// Pure layout math for the tile board. Kept out of the component so it can be
// tested directly — this is where the original's hit-testing bug lived, since it
// divided by a hardcoded 36px instead of the actual cell size.

export interface BoardLayout {
  /** Side length of one cell, in CSS pixels. Zero when there's no room to draw. */
  cell: number;
  /** Left edge of the grid within the drawing surface. */
  originX: number;
  /** Top edge of the grid within the drawing surface. */
  originY: number;
  /** Total grid size, i.e. cell * columns / cell * rows. */
  width: number;
  height: number;
}

/**
 * Fit a `columns` x `rows` grid of square cells into the available box and
 * center it. Cell size is floored so tile edges land on whole pixels.
 */
export const computeBoardLayout = (
  availableWidth: number,
  availableHeight: number,
  columns: number,
  rows: number
): BoardLayout => {
  if (columns <= 0 || rows <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return { cell: 0, originX: 0, originY: 0, width: 0, height: 0 };
  }

  const cell = Math.max(0, Math.floor(Math.min(availableWidth / columns, availableHeight / rows)));
  const width = cell * columns;
  const height = cell * rows;

  return {
    cell,
    originX: Math.floor((availableWidth - width) / 2),
    originY: Math.floor((availableHeight - height) / 2),
    width,
    height,
  };
};

export interface SelectionRing {
  radius: number;
  /** Dark backing stroke, so the ring reads against light tiles too. */
  haloWidth: number;
  /** Bright stroke drawn on top of the halo. */
  ringWidth: number;
}

/**
 * Geometry for the pivot marker. It's drawn as a haloed ring rather than a
 * filled disc because a translucent fill disappears against the near-white
 * tile — with a dark halo under a bright stroke, one of the two always
 * contrasts whatever color is beneath.
 */
export const selectionRingMetrics = (cell: number): SelectionRing => {
  const radius = Math.max(0, cell * 0.26);
  // Keep the halo from swallowing the ring on very small boards.
  const haloWidth = Math.min(Math.max(2, cell * 0.14), radius * 1.2);
  const ringWidth = Math.min(Math.max(1, cell * 0.075), haloWidth * 0.6);

  return { radius, haloWidth, ringWidth };
};

/**
 * Which cell contains a point, in the same coordinate space as the layout.
 * Returns null for points outside the grid — including the centering margins.
 */
export const cellAtPoint = (
  layout: BoardLayout,
  columns: number,
  rows: number,
  x: number,
  y: number
): { x: number; y: number } | null => {
  if (layout.cell <= 0) return null;

  const gridX = Math.floor((x - layout.originX) / layout.cell);
  const gridY = Math.floor((y - layout.originY) / layout.cell);

  if (gridX < 0 || gridX >= columns || gridY < 0 || gridY >= rows) {
    return null;
  }
  return { x: gridX, y: gridY };
};
