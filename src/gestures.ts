// Pointer gesture handling — the one piece of the old `tangle/inputManager`
// worth keeping. A single pointer stream resolves to either a tap or a swipe,
// so the board can support tap-to-select and swipe-to-shift without the two
// fighting each other.

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface GestureHandlers {
  /** Fired when the pointer went down and up again without travelling far. */
  onTap?: (clientX: number, clientY: number) => void;
  /** Fired on a directional drag. Coordinates are where the gesture *started*. */
  onSwipe?: (direction: SwipeDirection, clientX: number, clientY: number) => void;
}

export interface GestureOptions {
  /** Movement up to this distance (px) still counts as a tap. */
  tapRadius?: number;
  /** Movement of at least this distance (px) counts as a swipe. */
  swipeDistance?: number;
}

const DEFAULT_TAP_RADIUS = 10;
const DEFAULT_SWIPE_DISTANCE = 24;

/**
 * Resolve a pointer delta to a swipe direction, or null if the movement was too
 * small or too ambiguous to call. Pure, so the thresholds are testable.
 */
export const classifySwipe = (
  dx: number,
  dy: number,
  minDistance: number = DEFAULT_SWIPE_DISTANCE
): SwipeDirection | null => {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) < minDistance) return null;
  // A perfectly diagonal drag has no dominant axis — don't guess.
  if (absX === absY) return null;

  if (absX > absY) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
};

/**
 * Attach tap/swipe handling to an element. Returns a cleanup function.
 *
 * The element should set `touch-action: none` so the browser doesn't claim the
 * gesture for scrolling before we see it.
 */
export const onPointerGesture = (
  target: HTMLElement,
  handlers: GestureHandlers,
  options: GestureOptions = {}
): (() => void) => {
  const tapRadius = options.tapRadius ?? DEFAULT_TAP_RADIUS;
  const swipeDistance = options.swipeDistance ?? DEFAULT_SWIPE_DISTANCE;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;

  const handleDown = (event: PointerEvent): void => {
    if (pointerId !== null) return; // ignore additional fingers mid-gesture
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    target.setPointerCapture(event.pointerId);
  };

  const handleUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const direction = classifySwipe(dx, dy, swipeDistance);

    if (direction) {
      handlers.onSwipe?.(direction, startX, startY);
    } else if (Math.hypot(dx, dy) <= tapRadius) {
      handlers.onTap?.(event.clientX, event.clientY);
    }
  };

  const handleCancel = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
  };

  target.addEventListener('pointerdown', handleDown);
  target.addEventListener('pointerup', handleUp);
  target.addEventListener('pointercancel', handleCancel);

  return () => {
    target.removeEventListener('pointerdown', handleDown);
    target.removeEventListener('pointerup', handleUp);
    target.removeEventListener('pointercancel', handleCancel);
  };
};
