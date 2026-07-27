import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cellAtPoint, computeBoardLayout, selectionRingMetrics } from '/src/boardGeometry.js';

test('cells are square and sized by the tighter axis', () => {
  // 400x200 box, 4x4 grid -> height is the constraint, so 50px cells.
  const layout = computeBoardLayout(400, 200, 4, 4);
  assert.equal(layout.cell, 50);
  assert.equal(layout.width, 200);
  assert.equal(layout.height, 200);
});

test('the grid is centered in whatever space is left over', () => {
  const layout = computeBoardLayout(400, 200, 4, 4);
  assert.equal(layout.originX, 100, 'should be centered horizontally');
  assert.equal(layout.originY, 0, 'should fill vertically');
});

test('non-square boards keep square cells', () => {
  // The 6x4 level: 6 columns, 4 rows in a 300x300 box.
  const layout = computeBoardLayout(300, 300, 6, 4);
  assert.equal(layout.cell, 50, 'width is the constraint at 6 columns');
  assert.equal(layout.width, 300);
  assert.equal(layout.height, 200);
  assert.equal(layout.originX, 0);
  assert.equal(layout.originY, 50, 'vertically centered');
});

test('a box with no room yields a zero layout rather than a negative one', () => {
  const layout = computeBoardLayout(0, 0, 5, 5);
  assert.equal(layout.cell, 0);
  assert.equal(layout.width, 0);
  assert.equal(layout.height, 0);
});

/**
 * Regression: the original `_get_click_target` divided by a hardcoded `36`
 * instead of the computed cell size, so hit-testing only worked on a 5x5 board
 * at the original fixed canvas size. Cell size must always be derived.
 */
test('hit-testing uses the computed cell size, at any board size', () => {
  const layout = computeBoardLayout(280, 280, 7, 7); // 40px cells, not 36
  assert.equal(layout.cell, 40);

  assert.deepEqual(cellAtPoint(layout, 7, 7, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(cellAtPoint(layout, 7, 7, 41, 41), { x: 1, y: 1 });
  assert.deepEqual(cellAtPoint(layout, 7, 7, 279, 279), { x: 6, y: 6 });

  // With the old hardcoded 36 this point would have reported column 3.
  assert.deepEqual(cellAtPoint(layout, 7, 7, 130, 10), { x: 3, y: 0 });
});

test('hit-testing accounts for the centering offset', () => {
  const layout = computeBoardLayout(400, 200, 4, 4); // 50px cells, originX 100
  assert.equal(cellAtPoint(layout, 4, 4, 50, 50), null, 'left margin is not the board');
  assert.deepEqual(cellAtPoint(layout, 4, 4, 100, 0), { x: 0, y: 0 });
  assert.deepEqual(cellAtPoint(layout, 4, 4, 175, 25), { x: 1, y: 0 });
});

test('points outside the grid return null', () => {
  const layout = computeBoardLayout(200, 200, 4, 4); // 50px cells, no margin

  assert.equal(cellAtPoint(layout, 4, 4, -1, 10), null, 'left of the board');
  assert.equal(cellAtPoint(layout, 4, 4, 10, -1), null, 'above the board');
  assert.equal(cellAtPoint(layout, 4, 4, 200, 10), null, 'right of the board');
  assert.equal(cellAtPoint(layout, 4, 4, 10, 200), null, 'below the board');
});

test('a zero-size layout cannot be hit-tested', () => {
  const layout = computeBoardLayout(0, 0, 5, 5);
  assert.equal(cellAtPoint(layout, 5, 5, 0, 0), null);
});

test('the selection ring scales with the cell', () => {
  const small = selectionRingMetrics(20);
  const large = selectionRingMetrics(80);

  assert.ok(large.radius > small.radius, 'radius should grow with the cell');
  assert.ok(large.radius < 80 / 2, 'ring must stay inside its cell');
});

/**
 * A 7x7 board on a narrow phone gives small cells. The halo is what makes the
 * pivot visible on light tiles, so it must never grow wide enough to swallow
 * the ring or push the stroke inside-out.
 */
test('the selection ring stays well-formed at every usable cell size', () => {
  for (let cell = 1; cell <= 200; cell++) {
    const { radius, haloWidth, ringWidth } = selectionRingMetrics(cell);

    assert.ok(radius > 0, `radius collapsed at cell ${cell}`);
    assert.ok(haloWidth > 0 && ringWidth > 0, `stroke collapsed at cell ${cell}`);
    assert.ok(ringWidth < haloWidth, `ring must sit inside the halo at cell ${cell}`);
    assert.ok(
      radius - haloWidth / 2 > 0,
      `halo swallowed the ring at cell ${cell} (r=${radius}, halo=${haloWidth})`
    );
    assert.ok(radius + haloWidth / 2 <= cell / 2, `ring overflowed its cell at cell ${cell}`);
  }
});

test('a zero-size cell yields a degenerate but non-negative ring', () => {
  const ring = selectionRingMetrics(0);
  assert.equal(ring.radius, 0);
  assert.ok(ring.haloWidth >= 0 && ring.ringWidth >= 0);
});
