/**
 * Tells a drag from a tap from a long press on one element, for mouse and touch
 * alike.
 *
 * The cube is rotated by dragging and letters are picked by double tapping or
 * pressing and holding, so these have to be separated cleanly: a rotation that
 * accidentally selects a letter, or a selection that accidentally spins the
 * cube, both feel broken.
 */

const MOVE_THRESHOLD_PX = 8;
const TAP_MAX_MS = 300;
const DOUBLE_TAP_MAX_MS = 320;
const LONG_PRESS_MS = 500;

export interface GestureHandlers {
  onDragStart?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  onTap?: (clientX: number, clientY: number) => void;
  onDoubleTap?: (clientX: number, clientY: number) => void;
  onLongPress?: (clientX: number, clientY: number) => void;
}

export function attachGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;
  let dragging = false;
  let consumed = false;
  let longPressTimer: number | undefined;

  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  const distanceFromStart = (x: number, y: number) => Math.hypot(x - startX, y - startY);

  const clearLongPress = () => {
    if (longPressTimer !== undefined) {
      window.clearTimeout(longPressTimer);
      longPressTimer = undefined;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (pointerId !== null) return; // ignore a second finger
    pointerId = event.pointerId;
    element.setPointerCapture(event.pointerId);

    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    startTime = performance.now();
    dragging = false;
    consumed = false;

    longPressTimer = window.setTimeout(() => {
      if (dragging || consumed) return;
      consumed = true;
      handlers.onLongPress?.(startX, startY);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;

    if (!dragging && distanceFromStart(event.clientX, event.clientY) > MOVE_THRESHOLD_PX) {
      dragging = true;
      clearLongPress();
      handlers.onDragStart?.();
    }
    if (dragging) {
      handlers.onDrag?.(event.clientX - lastX, event.clientY - lastY);
    }
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    clearLongPress();
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    pointerId = null;

    if (dragging) {
      handlers.onDragEnd?.();
      return;
    }
    if (consumed) return; // the long press already handled it

    const now = performance.now();
    if (now - startTime > TAP_MAX_MS) return;

    const isDoubleTap =
      now - lastTapTime < DOUBLE_TAP_MAX_MS &&
      Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) <= MOVE_THRESHOLD_PX;

    if (isDoubleTap) {
      lastTapTime = 0;
      handlers.onDoubleTap?.(event.clientX, event.clientY);
      return;
    }

    lastTapTime = now;
    lastTapX = event.clientX;
    lastTapY = event.clientY;
    handlers.onTap?.(event.clientX, event.clientY);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    clearLongPress();
    pointerId = null;
    if (dragging) handlers.onDragEnd?.();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);

  return () => {
    clearLongPress();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
  };
}
