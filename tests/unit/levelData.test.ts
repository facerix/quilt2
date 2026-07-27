import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from '../../src/levelData.ts';

test('every level grid is exactly width * height cells', () => {
  LEVELS.forEach((level, i) => {
    const expected = level.width * level.height;
    assert.equal(level.start.length, expected, `level ${i + 1} start has wrong cell count`);
    assert.equal(level.goal.length, expected, `level ${i + 1} goal has wrong cell count`);
  });
});

test('every tile color is within the 0-7 palette', () => {
  LEVELS.forEach((level, i) => {
    [...level.start, ...level.goal].forEach(color => {
      assert.ok(
        Number.isInteger(color) && color >= 0 && color <= 7,
        `level ${i + 1} has out-of-range color ${color}`
      );
    });
  });
});

/**
 * Shifting only ever permutes tiles — no tile is created, destroyed or
 * recolored. So a goal that is not a rearrangement of the start is
 * *unreachable*, and the level can never be completed.
 */
test('every level goal is a permutation of its start (i.e. is solvable)', () => {
  const tally = (colors: readonly number[]): Map<number, number> => {
    const counts = new Map<number, number>();
    colors.forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1));
    return counts;
  };

  LEVELS.forEach((level, i) => {
    const startCounts = tally(level.start);
    const goalCounts = tally(level.goal);
    const colors = new Set([...startCounts.keys(), ...goalCounts.keys()]);

    colors.forEach(color => {
      assert.equal(
        goalCounts.get(color) ?? 0,
        startCounts.get(color) ?? 0,
        `level ${i + 1} is unsolvable: color ${color} appears ${startCounts.get(color) ?? 0}x ` +
          `in start but ${goalCounts.get(color) ?? 0}x in goal`
      );
    });
  });
});

test('no level starts already solved', () => {
  LEVELS.forEach((level, i) => {
    const identical = level.start.every((color, idx) => color === level.goal[idx]);
    assert.ok(!identical, `level ${i + 1} starts in its solved state`);
  });
});
