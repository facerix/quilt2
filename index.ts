import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import DataStore from '/src/DataStore.js';
import { GameController } from '/src/GameController.js';
import { LEVELS } from '/src/levelData.js';
import { findLevelProgress, furthestUnsolvedLevel } from '/src/progress.js';
import '/components/UpdateNotification.js';
import '/components/QuiltBoard.js';
import '/components/HelpOverlay.js';

import type { GameSnapshot, GameState } from '/src/GameController.js';
import type { ShiftDirection, ShiftResult, TileSet } from '/src/TileSet.js';
import type { TileSelectDetail, TileShiftDetail } from '/components/QuiltBoard.js';
import type QuiltBoard from '/components/QuiltBoard.js';
import type HelpOverlay from '/components/HelpOverlay.js';

/** Look up a required element, failing loudly rather than silently doing nothing. */
const mustFind = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`index: required element "${selector}" is missing from the page`);
  }
  return element;
};

const BANNER_TEXT: Record<GameState, string> = {
  play: '',
  cleared: 'Level cleared!',
  win: 'You win!',
};

const MOVE_KEYS: Record<string, ShiftDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Numpad8: 'up',
  Numpad2: 'down',
  Numpad4: 'left',
  Numpad6: 'right',
};

const SHIFT_KEYS: Record<string, ShiftDirection> = {
  KeyI: 'up',
  KeyK: 'down',
  KeyJ: 'left',
  KeyL: 'right',
};

const PAD_BUTTONS: ReadonlyArray<readonly [string, ShiftDirection]> = [
  ['#btnShiftUp', 'up'],
  ['#btnShiftDown', 'down'],
  ['#btnShiftLeft', 'left'],
  ['#btnShiftRight', 'right'],
];

const startGame = async (): Promise<void> => {
  await Promise.all([
    customElements.whenDefined('quilt-board'),
    customElements.whenDefined('help-overlay'),
  ]);
  await DataStore.init();

  const board = mustFind<QuiltBoard>('#board');
  const preview = mustFind<QuiltBoard>('#preview');
  const help = mustFind<HelpOverlay>('help-overlay');
  const banner = mustFind<HTMLElement>('#banner');
  const levelLabel = mustFind<HTMLElement>('#levelLabel');

  const recordSolve = (levelIndex: number, moves: number): void => {
    const existing = findLevelProgress(DataStore.items, levelIndex);
    if (existing) {
      // Keep the best run rather than the most recent one.
      const best = existing.solved ? Math.min(existing.moves, moves) : moves;
      DataStore.updateItem({ ...existing, solved: true, moves: best });
    } else {
      DataStore.addItem({ id: '', levelIndex, solved: true, moves });
    }
  };

  const game = new GameController({ levels: LEVELS, onSolve: recordSolve });

  // Only hand the board a new TileSet when the level actually changes —
  // setTileSet cancels any in-flight animation.
  let currentTileSet: TileSet | null = null;

  game.addEventListener('change', event => {
    const snapshot = (event as CustomEvent<GameSnapshot>).detail;

    if (snapshot.tileSet !== currentTileSet) {
      currentTileSet = snapshot.tileSet;
      board.setTileSet(snapshot.tileSet);
      preview.setTileSet(snapshot.goalSet);
    } else {
      board.render();
    }

    levelLabel.innerText = `Level ${snapshot.levelNumber} of ${snapshot.levelCount}`;

    const text = BANNER_TEXT[snapshot.state];
    banner.innerText = text;
    banner.classList.toggle('u-hidden', text === '');
  });

  game.addEventListener('shift', event => {
    board.animateShift((event as CustomEvent<ShiftResult>).detail);
  });

  board.addEventListener('tile-select', event => {
    const { x, y } = (event as CustomEvent<TileSelectDetail>).detail;
    game.selectCell(x, y);
  });

  board.addEventListener('tile-shift', event => {
    const { x, y, direction } = (event as CustomEvent<TileShiftDetail>).detail;
    game.selectCell(x, y);
    game.shift(direction);
  });

  mustFind('#btnHelp').addEventListener('click', () => help.show());
  mustFind('#btnRestart').addEventListener('click', () => game.restart());
  PAD_BUTTONS.forEach(([selector, direction]) => {
    mustFind(selector).addEventListener('click', () => game.shift(direction));
  });

  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.code === 'Escape') {
      // When the dialog is open the browser's own Esc handling closes it.
      if (!help.open) help.show();
      return;
    }
    if (help.open) return;

    const move = MOVE_KEYS[event.code];
    if (move) {
      event.preventDefault();
      game.moveSelection(move);
      return;
    }

    const shift = SHIFT_KEYS[event.code];
    if (shift) {
      event.preventDefault();
      game.shift(shift);
      return;
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      game.restart();
    }
  });

  game.start(furthestUnsolvedLevel(DataStore.items, LEVELS.length) ?? 0);
};

const registerServiceWorker = async (): Promise<void> => {
  await customElements.whenDefined('update-notification');
  const updateNotification = document.querySelector('update-notification');

  window.addEventListener('sw-update-available', event => {
    console.log('Service worker update available, showing notification');
    updateNotification?.show(event.detail.pendingWorker);
  });

  await serviceWorkerManager.register();
};

await startGame();
await registerServiceWorker();
