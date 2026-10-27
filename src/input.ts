// Mouse- and touch-only controls. No keyboard.
//
//   single click / tap  -> hop toward that point (relative to the player's
//                           current on-screen position, not a fixed screen
//                           half — otherwise a click right of the player
//                           near the start of a level, where the camera is
//                           clamped and the player sits near the left edge
//                           of the canvas, could land in the "left half"
//                           and hop the wrong way)
//   double-click / double-tap -> jump, launched toward that point
//   right-click / swipe right -> attack
//
// Each action is a one-shot flag, consumed (and cleared) by game.ts once per
// frame via the consume* functions below. Click/tap positions are reported
// in the canvas's own internal pixel space (its width/height attributes),
// not raw page coordinates, so game.ts can compare them directly against
// player.x/y.

export interface Point {
  x: number;
  y: number;
}

const DOUBLE_CLICK_MS = 300;
const DOUBLE_MAX_DX = 80;
const SWIPE_MIN_DX = 40;
const SWIPE_MAX_DY = 60;
const SWIPE_MAX_MS = 400;

let pendingClickX: number | null = null;
let pendingJumpTarget: Point | null = null;
let pendingAttack = false;

function getCanvas(): HTMLCanvasElement | null {
  return document.getElementById("game") as HTMLCanvasElement | null;
}

// Convert a page-space clientX into the canvas's internal pixel space.
function canvasLocalX(clientX: number): number {
  const canvas = getCanvas();
  if (!canvas) return clientX;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return clientX;
  return ((clientX - rect.left) / rect.width) * canvas.width;
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

// --- mouse ------------------------------------------------------------

let lastClickTime = 0;
let lastClickX = 0;

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // right-click handled via contextmenu
  const now = performance.now();
  if (now - lastClickTime < DOUBLE_CLICK_MS && Math.abs(e.clientX - lastClickX) < DOUBLE_MAX_DX) {
    pendingJumpTarget = canvasLocalPoint(e.clientX, e.clientY);
    lastClickTime = 0;
  } else {
    pendingClickX = canvasLocalX(e.clientX);
    lastClickTime = now;
    lastClickX = e.clientX;
  }
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  pendingAttack = true;
});

// --- touch --------------------------------------------------------------

interface TouchStart {
  x: number;
  y: number;
  t: number;
}

const touchStart = new Map<number, TouchStart>();
let lastTapTime = 0;
let lastTapX = 0;

window.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      touchStart.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now() });
    }
  },
  { passive: false },
);

function endTouch(e: TouchEvent): void {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    const start = touchStart.get(t.identifier);
    touchStart.delete(t.identifier);
    if (!start) continue;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = performance.now() - start.t;

    if (dx > SWIPE_MIN_DX && Math.abs(dy) < SWIPE_MAX_DY && dt < SWIPE_MAX_MS) {
      pendingAttack = true;
      continue;
    }

    const now = performance.now();
    if (now - lastTapTime < DOUBLE_CLICK_MS && Math.abs(t.clientX - lastTapX) < DOUBLE_MAX_DX) {
      pendingJumpTarget = canvasLocalPoint(t.clientX, t.clientY);
      lastTapTime = 0;
    } else {
      pendingClickX = canvasLocalX(t.clientX);
      lastTapTime = now;
      lastTapX = t.clientX;
    }
  }
}

window.addEventListener("touchend", endTouch, { passive: false });
window.addEventListener("touchcancel", (e) => {
  for (const t of Array.from(e.changedTouches)) touchStart.delete(t.identifier);
}, { passive: false });

// --- consumers ------------------------------------------------------------

// Canvas-local x of a pending click/tap, or null. Compare against the
// player's own on-screen x to decide which way to hop.
export function consumeClickX(): number | null {
  const x = pendingClickX;
  pendingClickX = null;
  return x;
}

// Canvas-local point a jump was requested toward, or null. game.ts aims the
// launch at this point relative to the player's own on-screen position.
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

// Any pending action — used to dismiss the death/win overlay and restart.
export function consumeAnyAction(): boolean {
  const had = pendingClickX !== null || pendingJumpTarget !== null || pendingAttack;
  pendingClickX = null;
  pendingJumpTarget = null;
  pendingAttack = false;
  return had;
}
