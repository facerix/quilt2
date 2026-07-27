import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  findLevelProgress,
  furthestUnsolvedLevel,
  solvedLevels,
  toLevelProgress,
} from '../../src/progress.ts';
import type { LevelProgress } from '../../src/progress.ts';

const record = (levelIndex: number, solved: boolean, moves = 0): LevelProgress => ({
  id: `id-${levelIndex}`,
  levelIndex,
  solved,
  moves,
});

test('furthestUnsolvedLevel starts at the first level when nothing is recorded', () => {
  assert.equal(furthestUnsolvedLevel([], 9), 0);
});

test('furthestUnsolvedLevel resumes after a run of solved levels', () => {
  const records = [record(0, true), record(1, true)];
  assert.equal(furthestUnsolvedLevel(records, 9), 2);
});

test('furthestUnsolvedLevel returns the *first* gap, not the highest solved level', () => {
  // Solving out of order shouldn't skip the level that was never finished.
  const records = [record(0, true), record(2, true)];
  assert.equal(furthestUnsolvedLevel(records, 9), 1);
});

test('furthestUnsolvedLevel ignores records that were started but not solved', () => {
  const records = [record(0, true), record(1, false, 12)];
  assert.equal(furthestUnsolvedLevel(records, 9), 1);
});

test('furthestUnsolvedLevel returns null once every level is solved', () => {
  const records = [record(0, true), record(1, true), record(2, true)];
  assert.equal(furthestUnsolvedLevel(records, 3), null);
});

test('furthestUnsolvedLevel ignores progress for levels that no longer exist', () => {
  // Levels can be removed between releases; stale records must not strand the player.
  const records = [record(0, true), record(1, true), record(7, true)];
  assert.equal(furthestUnsolvedLevel(records, 3), 2);
});

test('solvedLevels collects only the solved indices', () => {
  const records = [record(0, true), record(1, false), record(2, true)];
  assert.deepEqual([...solvedLevels(records)].sort(), [0, 2]);
});

test('findLevelProgress matches on levelIndex, since record ids are store-generated', () => {
  const records = [record(0, true), record(1, false, 5)];
  assert.equal(findLevelProgress(records, 1)?.moves, 5);
  assert.equal(findLevelProgress(records, 4), undefined);
});

test('findLevelProgress prefers a solved record when duplicates exist', () => {
  // DataStore.addItem always mints a new id, so duplicates are possible.
  const records = [record(3, false, 2), record(3, true, 9)];
  assert.equal(findLevelProgress(records, 3)?.solved, true);
});

test('toLevelProgress rejects records that are not level progress', () => {
  assert.equal(toLevelProgress({ id: 'x' }), null, 'missing fields');
  assert.equal(toLevelProgress({ id: 'x', levelIndex: 'two', solved: true, moves: 0 }), null);
  assert.equal(toLevelProgress({ id: 'x', levelIndex: 1.5, solved: true, moves: 0 }), null);
  assert.equal(toLevelProgress({ id: 'x', levelIndex: -1, solved: true, moves: 0 }), null);
  assert.deepEqual(toLevelProgress({ id: 'x', levelIndex: 1, solved: true, moves: 3 }), {
    id: 'x',
    levelIndex: 1,
    solved: true,
    moves: 3,
  });
});

test('corrupt records are skipped rather than derailing progress', () => {
  const records = [
    record(0, true),
    { id: 'junk', levelIndex: 'nope', solved: true, moves: 0 },
    record(1, true),
  ];
  assert.equal(furthestUnsolvedLevel(records, 9), 2);
});
