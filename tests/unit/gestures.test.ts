import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifySwipe } from '/src/gestures.js';

test('a swipe resolves to its dominant axis', () => {
  assert.equal(classifySwipe(40, 5), 'right');
  assert.equal(classifySwipe(-40, 5), 'left');
  assert.equal(classifySwipe(5, 40), 'down');
  assert.equal(classifySwipe(5, -40), 'up');
});

test('a mostly-horizontal drag is horizontal even with vertical drift', () => {
  assert.equal(classifySwipe(40, 39), 'right');
  assert.equal(classifySwipe(-40, -39), 'left');
});

test('movement below the threshold is not a swipe', () => {
  assert.equal(classifySwipe(10, 4), null, 'a tap with a little drift');
  assert.equal(classifySwipe(0, 0), null, 'a dead-still press');
  assert.equal(classifySwipe(23, 23), null, 'just under the default threshold');
});

test('the threshold is measured on the dominant axis, not the diagonal', () => {
  // 20px across and 20px down is 28px of travel, but neither axis has moved far
  // enough to be a confident direction.
  assert.equal(classifySwipe(20, 20), null);
  assert.equal(classifySwipe(25, 0), 'right', 'one axis clearing the bar is enough');
});

test('a perfectly diagonal drag is refused rather than guessed', () => {
  assert.equal(classifySwipe(50, 50), null);
  assert.equal(classifySwipe(-50, 50), null);
});

test('the threshold is configurable', () => {
  assert.equal(classifySwipe(10, 0), null, 'too small by default');
  assert.equal(classifySwipe(10, 0, 8), 'right', 'passes with a lower threshold');
  assert.equal(classifySwipe(30, 0, 100), null, 'fails with a higher threshold');
});
