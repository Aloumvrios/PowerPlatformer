// Mouse- and touch-only controls. No keyboard.
//
//   single click / tap (left/right half of the canvas) -> hop in that direction
//   double-click / double-tap                           -> jump
//   right-click / swipe right                            -> attack
//
// Each action is a one-shot flag, consumed (and cleared) by game.ts once per
// frame via the consume* functions below.

const DOUBLE_CLICK_MS = 300;
const DOUBLE_MAX_DX = 80;
const SWIPE_MIN_DX = 40;
const SWIPE_MAX_DY = 60;
const SWIPE_MAX_MS = 400;

let pendingHopDir: 1 | -1 | null = null;
let pendingJump = false;
let pendingAttack = false;

function getCanvas(): HTMLCanvasElement | null {
  return document.getElementById("game") as HTMLCanvasElement | null;
}

function dirForX(clientX: number): 1 | -1 {
  const rect = getCanvas()?.getBoundingClientRect();
  const midX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  return clientX < midX ? -1 : 1;
}

// --- mouse ------------------------------------------------------------

let lastClickTime = 0;
let lastClickX = 0;

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // right-click handled via contextmenu
  const now = performance.now();
  if (now - lastClickTime < DOUBLE_CLICK_MS && Math.abs(e.clientX - lastClickX) < DOUBLE_MAX_DX) {
    pendingJump = true;
    lastClickTime = 0;
  } else {
    pendingHopDir = dirForX(e.clientX);
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
      pendingJump = true;
      lastTapTime = 0;
    } else {
      pendingHopDir = dirForX(t.clientX);
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

export function consumeHopDirection(): 1 | -1 | null {
  const d = pendingHopDir;
  pendingHopDir = null;
  return d;
}

export function consumeJump(): boolean {
  if (pendingJump) {
    pendingJump = false;
    return true;
  }
  return false;
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
  const had = pendingHopDir !== null || pendingJump || pendingAttack;
  pendingHopDir = null;
  pendingJump = false;
  pendingAttack = false;
  return had;
}
