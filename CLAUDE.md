# Quilt

A tile-shifting puzzle game — "something like a 2-D Rubik's cube". Built as a vanilla-TS Progressive Web App. Ported from the 2013 RequireJS/canvas original in `~/projects/quilt`.

## Domain

- **Genre**: Puzzle. Cyclically shift whole rows and columns of a colored grid until it matches a goal pattern. Tiles wrap around as they slide off an edge.
- **Levels**: 9 hand-authored levels in `src/levelData.ts`, escalating from a 2×2 to a 7×7.
- **Grids are column-major**: `index = x * height + y`.
- **Tile colors** are palette indices 0-7, resolved to the CSS custom properties `--tile-0` … `--tile-7`.
- **Data model**: `DataStore` persists to localStorage under the key `quilt`, holding one `LevelProgress` record per level (`levelIndex`, `solved`, `moves`). Levels themselves are content and live in source, not the store.

## Architecture

The rule that matters most:

> **Game logic never touches the renderer.** `TileSet`, `levelData`, `GameController`, `boardGeometry` and `progress` are pure and unit-tested under `node --test`. Canvas lives only in `components/QuiltBoard.ts`.

The original welded pixel coordinates into the puzzle logic, so none of it could be tested. Keep that boundary.

- **No game loop.** `requestAnimationFrame` runs only while a shift animation is in flight; the app is idle otherwise.
- **No bundler**, so every module is its own HTTP request. Any new module must be added to `sw-core.js` → `getCoreResources()` or offline breaks. Check with `pnpm build && find dist -name '*.js'`.
- Tests may import app source with absolute `/src/...` specifiers via `tests/browserSpecifierHooks.mjs`, registered by `node --test --import ./tests/register.mjs`.

## Coding Standards

- TypeScript compiled with `tsc` (no bundler). Output goes to `dist/`.
- Import specifiers use `.js` extensions (compiled output). Tests use `.ts` directly.
- DOM creation uses `h()` from `/src/domUtils.js` — never `createElement` directly.
- Web Components live in `/components/`, use Shadow DOM, kebab-case tags, and pair `customElements.define()` with `HTMLElementTagNameMap` augmentation.
- Absolute import paths (`/src/...`) in app source; relative paths only in tests.
- No frameworks, no heavy dependencies without approval.

## Dev Server

`pnpm dev` — tsc watch + asset-copy watcher + live-server on port 8088.

## Known quirks

- **Levels 8 and 9 render transposed** relative to how their arrays were authored (level 8's `start` is grouped as rows while its `goal` is grouped as columns). The arrays are ported byte-for-byte so the port matches the original exactly. Changing this changes the puzzles — it's a deliberate open decision, not a bug to tidy up.
