// Mouse- and touch-only controls. No keyboard.
//
//   single click / tap         -> weak aimed launch toward that point
//   double-click / double-tap  -> strong aimed launch toward that point (jump)
//   press and hold (no release)-> fly toward the pointer, full manual control,
//                                 for as long as it's held
//   right-click / swipe right  -> attack
//
// A press is only resolved once we know which of these it is: released
// quickly -> a tap; released after sitting still past HOLD_THRESHOLD_MS ->
// upgraded to a hold (fly) instead of firing a tap at all; moved like a
// swipe before that threshold -> left to resolve as a swipe/tap on release.
//
// Discrete actions (tap, double-tap, attack) are one-shot flags, consumed
// (and cleared) by game.ts once per frame via the consume* functions below.
// Holding is continuous state, read every frame via getFlyTarget() instead
// of being consumed. All positions are reported in the canvas's own
// internal pixel space (its width/height attributes), not raw page
// coordinates, so game.ts can compare them directly against player.x/y.

export interface Point {
  x: number;
  y: number;
}

const DOUBLE_CLICK_MS = 300;
const DOUBLE_MAX_DX = 80;
const SWIPE_MIN_DX = 40;
const SWIPE_MAX_DY = 60;
const SWIPE_MAX_MS = 400;
const HOLD_THRESHOLD_MS = 160;
const HOLD_STATIONARY_PX = 18;

let pendingClickTarget: Point | null = null;
let pendingJumpTarget: Point | null = null;
let pendingAttack = false;
let flyTarget: Point | null = null; // live, while any pointer is holding

function getCanvas(): HTMLCanvasElement | null {
  return document.getElementById("game") as HTMLCanvasElement | null;
}

// Convert a page-space point into the canvas's internal pixel space.
function canvasLocalPoint(clientX: number, clientY: number): Point {
  const canvas = getCanvas();
  if (!canvas) return { x: clientX, y: clientY };
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: clientX, y: clientY };
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
}

interface PointerState {
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  holding: boolean;
  holdTimer: ReturnType<typeof setTimeout>;
  isTouch: boolean;
}

const pointers = new Map<number, PointerState>();

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

function beginHold(id: number): void {
  const st = pointers.get(id);
  if (!st || st.moved) return; // released or drifted too far — not a hold
  st.holding = true;
  flyTarget = canvasLocalPoint(st.lastX, st.lastY);
}

window.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return; // right-click -> contextmenu
    e.preventDefault();

    const now = performance.now();
    if (
      now - lastTapTime < DOUBLE_CLICK_MS &&
      Math.abs(e.clientX - lastTapX) < DOUBLE_MAX_DX &&
      Math.abs(e.clientY - lastTapY) < DOUBLE_MAX_DX
    ) {
      pendingJumpTarget = canvasLocalPoint(e.clientX, e.clientY);
      lastTapTime = 0;
      return;
    }

    const id = e.pointerId;
    const holdTimer = setTimeout(() => beginHold(id), HOLD_THRESHOLD_MS);
    pointers.set(id, {
      startX: e.clientX,
      startY: e.clientY,
      startTime: now,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
      holding: false,
      holdTimer,
      isTouch: e.pointerType === "touch",
    });
  },
  { passive: false },
);

window.addEventListener(
  "pointermove",
  (e) => {
    const st = pointers.get(e.pointerId);
    if (!st) return;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    if (st.holding) {
      flyTarget = canvasLocalPoint(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.hypot(dx, dy) > HOLD_STATIONARY_PX) {
      st.moved = true;
    }
  },
  { passive: true },
);

function endPointer(e: PointerEvent): void {
  const st = pointers.get(e.pointerId);
  if (!st) return;
  pointers.delete(e.pointerId);
  clearTimeout(st.holdTimer);

  if (st.holding) {
    flyTarget = null;
    return;
  }

  const dx = e.clientX - st.startX;
  const dy = e.clientY - st.startY;
  const dt = performance.now() - st.startTime;

  if (st.isTouch && dx > SWIPE_MIN_DX && Math.abs(dy) < SWIPE_MAX_DY && dt < SWIPE_MAX_MS) {
    pendingAttack = true;
    return;
  }

  pendingClickTarget = canvasLocalPoint(st.startX, st.startY);
  lastTapTime = st.startTime;
  lastTapX = st.startX;
  lastTapY = st.startY;
}

window.addEventListener("pointerup", endPointer, { passive: true });
window.addEventListener("pointercancel", (e) => {
  const st = pointers.get(e.pointerId);
  if (st) clearTimeout(st.holdTimer);
  pointers.delete(e.pointerId);
  flyTarget = null;
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  pendingAttack = true;
});

// --- consumers ------------------------------------------------------------

// Canvas-local point of a pending single click/tap, or null.
export function consumeClickTarget(): Point | null {
  const p = pendingClickTarget;
  pendingClickTarget = null;
  return p;
}

// Canvas-local point a (double-click/tap) jump was requested toward, or null.
export function consumeJump(): Point | null {
  const target = pendingJumpTarget;
  pendingJumpTarget = null;
  return target;
}

export function consumeAttack(): boolean {
  if (pendingAttack) {
    pendingAttack = false;
    return true;
  }
  return false;
}

// Live canvas-local point to fly toward while a press is being held, or null
// when nothing is currently held. Not consumed — read every frame.
export function getFlyTarget(): Point | null {
  return flyTarget;
}

// Any pending discrete action — used to dismiss the death/win overlay and
// restart. A held press alone (no discrete action yet) does not count.
export function consumeAnyAction(): boolean {
  const had = pendingClickTarget !== null || pendingJumpTarget !== null || pendingAttack;
  pendingClickTarget = null;
  pendingJumpTarget = null;
  pendingAttack = false;
  return had;
}
