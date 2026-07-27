// Static level content for Quilt. This is content, not user data — it lives in
// source rather than in DataStore, which holds only the player's progress.

/**
 * A tile's color, as an index into the palette. The renderer maps these to the
 * `--tile-0` … `--tile-7` custom properties; nothing here knows about pixels.
 */
export type TileColor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Level {
  readonly width: number;
  readonly height: number;
  /** Column-major: index = x * height + y */
  readonly start: readonly TileColor[];
  /** Column-major: index = x * height + y */
  readonly goal: readonly TileColor[];
}

/**
 * Ported byte-for-byte from the 2013 `js/levelData.js`.
 *
 * Note the grids are column-major (index = x * height + y), matching the
 * original's `_index_to_xy`. Levels 8 and 9 appear to have been *authored* as
 * visual rows, which means they render transposed — see the port notes. The
 * arrays are deliberately left exactly as they were so this port is provably
 * identical to the original; transposing is a separate decision.
 */
export const LEVELS: readonly Level[] = [
  {
    width: 2,
    height: 2,
    start: [0, 0, 1, 1],
    goal: [0, 1, 1, 0],
  },
  {
    width: 3,
    height: 2,
    start: [0, 1, 1, 0, 1, 0],
    goal: [1, 0, 0, 1, 0, 1],
  },
  {
    width: 3,
    height: 3,
    start: [1, 0, 1, 0, 0, 0, 1, 0, 1],
    goal: [0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
  {
    width: 3,
    height: 3,
    start: [2, 4, 6, 2, 4, 6, 2, 4, 6],
    goal: [2, 2, 4, 2, 4, 6, 4, 6, 6],
  },
  {
    width: 4,
    height: 4,
    start: [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    goal: [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
  },
  {
    width: 4,
    height: 4,
    start: [6, 6, 6, 1, 6, 6, 6, 6, 6, 6, 6, 6, 1, 6, 6, 1],
    goal: [6, 6, 6, 6, 6, 1, 1, 6, 6, 1, 6, 6, 6, 6, 6, 6],
  },
  {
    width: 5,
    height: 5,
    start: [0, 1, 2, 1, 0, 1, 0, 2, 0, 1, 2, 2, 0, 2, 2, 1, 0, 2, 0, 1, 0, 1, 2, 1, 0],
    goal: [0, 0, 2, 1, 1, 0, 2, 0, 1, 1, 2, 0, 2, 2, 2, 0, 2, 0, 1, 1, 0, 0, 2, 1, 1],
  },
  {
    width: 6,
    height: 4,
    start: [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7],
    goal: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7],
  },
  {
    width: 7,
    height: 7,
    start: [
      1, 0, 0, 0, 1, 1, 1, 0, 2, 2, 2, 0, 1, 1, 0, 2, 2, 2, 2, 0, 1, 1, 0, 2, 1, 2, 1, 0, 0, 1, 1,
      1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1,
    ],
    goal: [
      1, 2, 2, 0, 0, 0, 1, 2, 1, 1, 1, 1, 1, 0, 2, 1, 0, 1, 0, 1, 0, 2, 1, 1, 1, 0, 1, 0, 2, 1, 0,
      1, 0, 1, 0, 2, 1, 1, 1, 1, 1, 0, 1, 2, 2, 0, 0, 0, 1,
    ],
  },
];
