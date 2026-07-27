import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TileSet } from '../../src/TileSet.ts';
import { LEVELS } from '../../src/levelData.ts';
import type { Level, TileColor } from '../../src/levelData.ts';
import type { ShiftDirection } from '../../src/TileSet.ts';

/**
 * Grids are stored column-major (index = x * height + y), which is hard to read
 * in a literal. These helpers let the tests be written and asserted as visual
 * rows, so a failure prints something a human can match against the board.
 */
const colMajor = (rows: readonly (readonly number[])[]): TileColor[] => {
  const height = rows.length;
  const width = rows[0]!.length;
  const flat: number[] = Array.from({ length: width * height }, () => 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      flat[x * height + y] = rows[y]![x]!;
    }
  }
  return flat as TileColor[];
};

const toRows = (tiles: readonly TileColor[], width: number, height: number): number[][] => {
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(tiles[x * height + y]!);
    }
    rows.push(row);
  }
  return rows;
};

const makeLevel = (
  startRows: readonly (readonly number[])[],
  goalRows?: readonly (readonly number[])[]
): Level => ({
  width: startRows[0]!.length,
  height: startRows.length,
  start: colMajor(startRows),
  goal: colMajor(goalRows ?? startRows),
});

const rowsOf = (ts: TileSet): number[][] => toRows(ts.tiles, ts.width, ts.height);

// A 2-wide, 3-tall board with six distinct colors — unambiguous for column shifts.
const TALL = [
  [0, 1],
  [2, 3],
  [4, 5],
];

// A 3-wide, 2-tall board with six distinct colors — unambiguous for row shifts.
const WIDE = [
  [0, 1, 2],
  [3, 4, 5],
];

test('column-major indexing round-trips through the tiles getter', () => {
  const ts = new TileSet(makeLevel(TALL));
  assert.deepEqual(ts.tiles, [0, 2, 4, 1, 3, 5]);
  assert.deepEqual(rowsOf(ts), TALL);
});

test('shifting a column down wraps the bottom tile to the top', () => {
  const ts = new TileSet(makeLevel(TALL));
  const result = ts.shift('down');

  assert.deepEqual(rowsOf(ts), [
    [4, 1],
    [0, 3],
    [2, 5],
  ]);
  assert.deepEqual(result, { axis: 'col', index: 0, delta: 1 });
});

test('shifting a column up wraps the top tile to the bottom', () => {
  const ts = new TileSet(makeLevel(TALL));
  const result = ts.shift('up');

  assert.deepEqual(rowsOf(ts), [
    [2, 1],
    [4, 3],
    [0, 5],
  ]);
  assert.deepEqual(result, { axis: 'col', index: 0, delta: -1 });
});

test('shifting a row right wraps the last tile to the front', () => {
  const ts = new TileSet(makeLevel(WIDE));
  const result = ts.shift('right');

  assert.deepEqual(rowsOf(ts), [
    [2, 0, 1],
    [3, 4, 5],
  ]);
  assert.deepEqual(result, { axis: 'row', index: 0, delta: 1 });
});

test('shifting a row left wraps the first tile to the end', () => {
  const ts = new TileSet(makeLevel(WIDE));
  const result = ts.shift('left');

  assert.deepEqual(rowsOf(ts), [
    [1, 2, 0],
    [3, 4, 5],
  ]);
  assert.deepEqual(result, { axis: 'row', index: 0, delta: -1 });
});

test('shifts act on the column/row containing the selection, not always the first', () => {
  const ts = new TileSet(makeLevel(TALL));
  ts.moveSelection('right'); // into column 1
  ts.moveSelection('down'); // row 1 — shouldn't change which column shifts

  const result = ts.shift('down');
  assert.deepEqual(rowsOf(ts), [
    [0, 5],
    [2, 1],
    [4, 3],
  ]);
  assert.deepEqual(result, { axis: 'col', index: 1, delta: 1 });
});

/**
 * Property: every shift is exactly undone by its opposite. Run against the real
 * levels so the wrap arithmetic is exercised at every board size we ship.
 */
test('each shift is undone by its opposite, on every shipped level', () => {
  const opposites: ReadonlyArray<readonly [ShiftDirection, ShiftDirection]> = [
    ['up', 'down'],
    ['down', 'up'],
    ['left', 'right'],
    ['right', 'left'],
  ];

  LEVELS.forEach((level, i) => {
    for (const [dir, undo] of opposites) {
      for (let position = 0; position < level.width * level.height; position++) {
        const ts = new TileSet(level);
        ts.selectIndex(position);
        const before = [...ts.tiles];

        ts.shift(dir);
        ts.shift(undo);

        assert.deepEqual(
          ts.tiles,
          before,
          `level ${i + 1}: ${dir} then ${undo} at cell ${position} did not restore the grid`
        );
      }
    }
  });
});

test('the selection stays put when a row or column shifts beneath it', () => {
  const ts = new TileSet(makeLevel(TALL));
  ts.moveSelection('down');
  const selected = ts.selected;

  ts.shift('down');
  assert.equal(ts.selected, selected, 'selection index moved with the tiles');

  ts.shift('right');
  assert.equal(ts.selected, selected, 'selection index moved with the tiles');
});

test('selection movement is clamped at all four edges', () => {
  // 2 wide, 3 tall. Column-major indices:  col0 = 0,1,2   col1 = 3,4,5
  const ts = new TileSet(makeLevel(TALL));

  assert.equal(ts.selected, 0, 'should start at the top-left cell');

  assert.equal(ts.moveSelection('up'), false, 'cannot move up from the top row');
  assert.equal(ts.selected, 0);

  assert.equal(ts.moveSelection('left'), false, 'cannot move left from the first column');
  assert.equal(ts.selected, 0);

  assert.equal(ts.moveSelection('down'), true);
  assert.equal(ts.moveSelection('down'), true);
  assert.equal(ts.selected, 2, 'should be at the bottom of column 0');
  assert.equal(ts.moveSelection('down'), false, 'cannot move down from the bottom row');
  assert.equal(ts.selected, 2);

  // Regression: the original guard was `selected < length - height + 1`, which
  // let the last column try to step off the board.
  assert.equal(ts.moveSelection('right'), true);
  assert.equal(ts.selected, 5, 'should be at the bottom of column 1');
  assert.equal(ts.moveSelection('right'), false, 'cannot move right from the last column');
  assert.equal(ts.selected, 5);
});

test('moving up and down does not leak between columns', () => {
  const ts = new TileSet(makeLevel(TALL));
  ts.moveSelection('right'); // index 3, top of column 1
  assert.equal(ts.selected, 3);
  assert.equal(ts.moveSelection('up'), false, 'index 3 is the top of column 1, not below index 2');
  assert.equal(ts.selected, 3);
});

test('isSolved is false until the grid exactly matches the goal', () => {
  const ts = new TileSet(
    makeLevel(
      [
        [0, 1],
        [2, 3],
        [4, 5],
      ],
      [
        [4, 1],
        [0, 3],
        [2, 5],
      ]
    )
  );

  assert.equal(ts.isSolved, false, 'should not be solved at the start');
  ts.shift('down');
  assert.equal(ts.isSolved, true, 'one shift should reach this goal');
});

/**
 * Regression: the original `_checkGoal()` initialized its flag to `true` and only
 * cleared it inside the comparison loop, so a missing or mismatched goal skipped
 * the loop entirely and reported the level as *solved*. Rather than make
 * `isSolved` defensive, malformed level data is rejected at construction — a
 * level that can never be won should fail loudly, not quietly.
 */
test('malformed level data is rejected at construction', () => {
  const base = makeLevel(WIDE);

  assert.throws(
    () => new TileSet({ ...base, goal: undefined as unknown as TileColor[] }),
    /goal/i,
    'a missing goal must be rejected'
  );
  assert.throws(
    () => new TileSet({ ...base, goal: [0, 1] as TileColor[] }),
    /goal/i,
    'a wrong-length goal must be rejected'
  );
  assert.throws(
    () => new TileSet({ ...base, start: [0, 1] as TileColor[] }),
    /start/i,
    'a wrong-length start must be rejected'
  );
  assert.throws(
    () => new TileSet({ ...base, width: 0 }),
    /dimensions/i,
    'a zero-size board must be rejected'
  );
});

/**
 * Regression: the original `_reset()` rebuilt the grid but never re-selected, so
 * the highlight vanished after pressing R.
 */
test('reset restores both the starting grid and the selection', () => {
  const ts = new TileSet(makeLevel(TALL));
  ts.moveSelection('right');
  ts.moveSelection('down');
  ts.shift('down');
  ts.shift('left');

  ts.reset();

  assert.deepEqual(rowsOf(ts), TALL, 'grid should be back to the level start');
  assert.equal(ts.selected, 0, 'selection should be back at the top-left cell');
});

test('the level passed in is never mutated', () => {
  const level = makeLevel(TALL);
  const pristine = [...level.start];

  const ts = new TileSet(level);
  ts.shift('down');
  ts.shift('right');

  assert.deepEqual(level.start, pristine, 'TileSet wrote through to the shared level data');
});

test('selectIndex rejects out-of-range cells', () => {
  const ts = new TileSet(makeLevel(TALL));
  assert.equal(ts.selectIndex(5), true);
  assert.equal(ts.selected, 5);
  assert.equal(ts.selectIndex(6), false, 'index past the end should be rejected');
  assert.equal(ts.selectIndex(-1), false, 'negative index should be rejected');
  assert.equal(ts.selected, 5, 'a rejected selection must not clear the current one');
});
