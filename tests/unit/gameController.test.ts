import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameController } from '/src/GameController.js';
import type { Level } from '/src/levelData.js';

// Solvable in one move: shifting row 1 swaps its two tiles into the goal.
const ONE_MOVE_LEVEL: Level = {
  width: 2,
  height: 2,
  start: [0, 0, 1, 1],
  goal: [0, 1, 1, 0],
};

/** A scheduler the test drives by hand, so no test ever waits on a real timer. */
const manualScheduler = () => {
  const pending: Array<() => void> = [];
  return {
    schedule: (fn: () => void): number => pending.push(fn),
    cancel: (): void => {
      pending.length = 0;
    },
    runAll: (): void => {
      const queued = [...pending];
      pending.length = 0;
      queued.forEach(fn => fn());
    },
    get count(): number {
      return pending.length;
    },
  };
};

const solveCurrentLevel = (game: GameController): void => {
  game.selectCell(0, 1);
  game.shift('right');
};

test('start() opens the first level in the play state', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL] });
  game.start();

  const snapshot = game.snapshot;
  assert.equal(snapshot.state, 'play');
  assert.equal(snapshot.levelIndex, 0);
  assert.equal(snapshot.levelNumber, 1);
  assert.equal(snapshot.levelCount, 1);
  assert.equal(snapshot.moves, 0);
});

test('start() can resume at a later level', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL, ONE_MOVE_LEVEL] });
  game.start(2);

  assert.equal(game.snapshot.levelIndex, 2);
  assert.equal(game.snapshot.levelNumber, 3);
});

test('start() clamps a resume index that is out of range', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL] });
  game.start(99);
  assert.equal(game.snapshot.levelIndex, 0, 'should fall back to the first level');
});

test('the goal preview shows the level goal, not the starting grid', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL] });
  game.start();
  assert.deepEqual(game.snapshot.goalSet.tiles, ONE_MOVE_LEVEL.goal);
});

test('shifts count as moves, moving the pivot does not', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL] });
  game.start();

  game.moveSelection('down');
  game.moveSelection('right');
  assert.equal(game.snapshot.moves, 0, 'pivot movement is not a move');

  game.shift('up');
  game.shift('down');
  assert.equal(game.snapshot.moves, 2);
});

test('solving a level enters the cleared state and reports the solve', () => {
  const solves: Array<{ levelIndex: number; moves: number }> = [];
  const scheduler = manualScheduler();
  const game = new GameController({
    levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL],
    onSolve: (levelIndex, moves) => solves.push({ levelIndex, moves }),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  game.start();
  solveCurrentLevel(game);

  assert.equal(game.snapshot.state, 'cleared');
  assert.deepEqual(solves, [{ levelIndex: 0, moves: 1 }]);
});

test('the cleared state advances to the next level and resets the move count', () => {
  const scheduler = manualScheduler();
  const game = new GameController({
    levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL],
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  game.start();
  solveCurrentLevel(game);
  assert.equal(scheduler.count, 1, 'advancing should have been scheduled');

  scheduler.runAll();

  assert.equal(game.snapshot.state, 'play');
  assert.equal(game.snapshot.levelIndex, 1);
  assert.equal(game.snapshot.moves, 0);
});

test('solving the last level wins the game instead of advancing', () => {
  const scheduler = manualScheduler();
  const solves: number[] = [];
  const game = new GameController({
    levels: [ONE_MOVE_LEVEL],
    onSolve: levelIndex => solves.push(levelIndex),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  game.start();
  solveCurrentLevel(game);

  assert.equal(game.snapshot.state, 'win');
  assert.deepEqual(solves, [0], 'the final level still counts as solved');
  assert.equal(scheduler.count, 0, 'nothing should be scheduled after a win');
});

test('input is ignored once a level is cleared', () => {
  const scheduler = manualScheduler();
  const game = new GameController({
    levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL],
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  game.start();
  solveCurrentLevel(game);
  const tilesAfterSolve = [...game.snapshot.tileSet.tiles];

  assert.equal(game.shift('left'), null, 'shifting should be refused');
  assert.equal(game.moveSelection('down'), false, 'pivot movement should be refused');
  assert.deepEqual(game.snapshot.tileSet.tiles, tilesAfterSolve, 'grid must not change');
  assert.equal(game.snapshot.moves, 1, 'refused input must not count as a move');
});

test('input is ignored after the game is won', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL] });
  game.start();
  solveCurrentLevel(game);

  assert.equal(game.snapshot.state, 'win');
  assert.equal(game.shift('left'), null);
});

test('restart puts the current level back to its starting grid', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL] });
  game.start();

  game.shift('up');
  game.moveSelection('right');
  game.restart();

  assert.deepEqual(game.snapshot.tileSet.tiles, ONE_MOVE_LEVEL.start);
  assert.equal(game.snapshot.moves, 0, 'restarting resets the move count');
  assert.equal(game.snapshot.levelIndex, 0, 'restarting stays on the same level');
  assert.equal(game.snapshot.tileSet.selected, 0);
});

test('a change event carries a snapshot on every transition', () => {
  const scheduler = manualScheduler();
  const states: string[] = [];
  const game = new GameController({
    levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL],
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  game.addEventListener('change', event => {
    states.push((event as CustomEvent).detail.state);
  });

  game.start();
  solveCurrentLevel(game);
  scheduler.runAll();

  assert.deepEqual(states, ['play', 'play', 'play', 'cleared', 'play']);
});

test('a shift event carries what moved, for the renderer to animate', () => {
  const results: unknown[] = [];
  const game = new GameController({ levels: [ONE_MOVE_LEVEL, ONE_MOVE_LEVEL] });
  game.addEventListener('shift', event => results.push((event as CustomEvent).detail));

  game.start();
  game.shift('down');

  assert.deepEqual(results, [{ axis: 'col', index: 0, delta: 1 }]);
});

test('selectCell rejects coordinates outside the board', () => {
  const game = new GameController({ levels: [ONE_MOVE_LEVEL] });
  game.start();

  assert.equal(game.selectCell(5, 5), false);
  assert.equal(game.snapshot.tileSet.selected, 0, 'selection should be untouched');
});

test('constructing with no levels throws rather than starting an empty game', () => {
  assert.throws(() => new GameController({ levels: [] }), /levels/i);
});
