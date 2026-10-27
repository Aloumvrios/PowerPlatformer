// Mouse- and touch-only controls. No keyboard.
//
//   single click / tap         -> weak aimed launch toward that point
//   double-click / double-tap  -> strong aimed launch toward that point (jump)
//   press and hold (no release)-> fly toward the pointer, full manual control,
//                                 for as long as it's held
//   right-click / swipe        -> attack, toward whichever side of the
//                                 player the click/swipe was on
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
//
// On-canvas buttons (pause/mute/fullscreen) are registered by game.ts via
// setUiButtons(); a press that starts on one is swallowed here instead of
// becoming a game action, and its callback fires synchronously on release
// so it still counts as a user gesture (fullscreen and audio need that).

import { VIEW_H, VIEW_W } from "./view";

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
// A swipe already carries its own direction; a right-click doesn't — its
// direction depends on which side of the player it landed on, which only
// game.ts knows (it has the player's position), so that one is resolved
// lazily by consumeAttack() instead of at the moment of the click.
let pendingAttackDir: 1 | -1 | null = null;
let pendingAttackClickX: number | null = null;
let flyTarget: Point | null = null; // live, while any pointer is holding

function getCanvas(): HTMLCanvasElement | null {
  return document.getElementById("game") as HTMLCanvasElement | null;
}

// Convert a page-space point into the game's logical 960x540 space. Not
// canvas.width/height: those are the HiDPI backing-store size, which varies.
function canvasLocalPoint(clientX: number, clientY: number): Point {
  const canvas = getCanvas();
  if (!canvas) return { x: clientX, y: clientY };
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: clientX, y: clientY };
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_W,
    y: ((clientY - rect.top) / rect.height) * VIEW_H,
  };
}

export interface UiButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onPress: () => void;
}

let uiButtons: UiButton[] = [];
const uiPresses = new Map<number, UiButton>(); // pointerId -> button pressed

export function setUiButtons(buttons: UiButton[]): void {
  uiButtons = buttons;
}

function hitButton(pt: Point): UiButton | null {
  for (const b of uiButtons) {
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return b;
  }
  return null;
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

    const button = hitButton(canvasLocalPoint(e.clientX, e.clientY));
    if (button) {
      uiPresses.set(e.pointerId, button);
      return;
    }

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
  const button = uiPresses.get(e.pointerId);
  if (button) {
    uiPresses.delete(e.pointerId);
    if (hitButton(canvasLocalPoint(e.clientX, e.clientY)) === button) button.onPress();
    return;
  }
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

  if (st.isTouch && Math.abs(dx) > SWIPE_MIN_DX && Math.abs(dy) < SWIPE_MAX_DY && dt < SWIPE_MAX_MS) {
    pendingAttackDir = dx > 0 ? 1 : -1;
    return;
  }

  pendingClickTarget = canvasLocalPoint(st.startX, st.startY);
  lastTapTime = st.startTime;
  lastTapX = st.startX;
  lastTapY = st.startY;
}

window.addEventListener("pointerup", endPointer, { passive: true });
window.addEventListener("pointercancel", (e) => {
  uiPresses.delete(e.pointerId);
  const st = pointers.get(e.pointerId);
  if (st) clearTimeout(st.holdTimer);
  pointers.delete(e.pointerId);
  flyTarget = null;
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const pt = canvasLocalPoint(e.clientX, e.clientY);
  if (hitButton(pt)) return;
  pendingAttackClickX = pt.x;
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

// Resolves and clears any pending attack request, returning which side to
// attack (1 = right, -1 = left) or null if none is pending. A swipe already
// knows its own direction; a right-click's direction is resolved here
// against the player's current on-screen x, passed in by the caller.
export function consumeAttack(playerScreenX: number): 1 | -1 | null {
  if (pendingAttackDir !== null) {
    const dir = pendingAttackDir;
    pendingAttackDir = null;
    return dir;
  }
  if (pendingAttackClickX !== null) {
    const dir = pendingAttackClickX >= playerScreenX ? 1 : -1;
    pendingAttackClickX = null;
    return dir;
  }
  return null;
}

// Live canvas-local point to fly toward while a press is being held, or null
// when nothing is currently held. Not consumed — read every frame.
export function getFlyTarget(): Point | null {
  return flyTarget;
}

// The press currently being decided between tap and hold, for on-screen
// feedback: `progress` runs 0 -> 1 over HOLD_THRESHOLD_MS and stays at 1
// once it has become a hold (flight). Null when nothing is pressed, or the
// press has drifted into a swipe.
export function getPressIndicator(): (Point & { progress: number }) | null {
  const now = performance.now();
  for (const st of pointers.values()) {
    if (st.moved) continue;
    const pt = canvasLocalPoint(st.lastX, st.lastY);
    const progress = st.holding ? 1 : Math.min(1, (now - st.startTime) / HOLD_THRESHOLD_MS);
    return { ...pt, progress };
  }
  return null;
}

// Any pending discrete action — used to dismiss the death/win overlay and
// restart. A held press alone (no discrete action yet) does not count.
export function consumeAnyAction(): boolean {
  const had =
    pendingClickTarget !== null ||
    pendingJumpTarget !== null ||
    pendingAttackDir !== null ||
    pendingAttackClickX !== null;
  pendingClickTarget = null;
  pendingJumpTarget = null;
  pendingAttackDir = null;
  pendingAttackClickX = null;
  return had;
}
