// Player progress: which levels have been solved, and in how many moves.
//
// Everything here is pure — it takes records in and returns values out. The
// actual DataStore reads and writes live in GameController, which keeps this
// module free of `window.localStorage` and therefore testable under `node --test`.

import type { DataRecord } from '/src/DataStore.js';

export interface LevelProgress extends DataRecord {
  levelIndex: number;
  solved: boolean;
  moves: number;
}

/**
 * Narrow a stored record to `LevelProgress`, or null if it isn't one.
 * Records come back from localStorage, so they can be anything — a record the
 * player hand-edited or one left over from an older schema must not be trusted.
 */
export const toLevelProgress = (record: DataRecord): LevelProgress | null => {
  const { levelIndex, solved, moves } = record;

  if (!Number.isInteger(levelIndex) || (levelIndex as number) < 0) return null;
  if (typeof solved !== 'boolean') return null;
  if (!Number.isInteger(moves) || (moves as number) < 0) return null;

  return record as LevelProgress;
};

export const levelProgressRecords = (records: readonly DataRecord[]): LevelProgress[] =>
  records.map(toLevelProgress).filter((record): record is LevelProgress => record !== null);

/**
 * Find the stored progress for a level. Records are matched on `levelIndex`
 * rather than `id` because `DataStore.addItem()` mints its own id, so we can't
 * key records by level. Duplicates are therefore possible — prefer a solved one.
 */
export const findLevelProgress = (
  records: readonly DataRecord[],
  levelIndex: number
): LevelProgress | undefined => {
  const matches = levelProgressRecords(records).filter(record => record.levelIndex === levelIndex);
  return matches.find(record => record.solved) ?? matches[0];
};

export const solvedLevels = (records: readonly DataRecord[]): Set<number> =>
  new Set(
    levelProgressRecords(records)
      .filter(record => record.solved)
      .map(record => record.levelIndex)
  );

/**
 * The level to drop the player into on load: the first one they haven't solved.
 * Returns null when every level is solved, which the caller treats as "start
 * over from the beginning" rather than stranding them past the last level.
 */
export const furthestUnsolvedLevel = (
  records: readonly DataRecord[],
  levelCount: number
): number | null => {
  const solved = solvedLevels(records);
  for (let index = 0; index < levelCount; index++) {
    if (!solved.has(index)) return index;
  }
  return null;
};
