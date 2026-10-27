const pressed = new Set<string>();

const KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  " ",
  "a",
  "d",
  "w",
  "r",
]);

window.addEventListener("keydown", (e) => {
  if (KEYS.has(e.key)) e.preventDefault();
  pressed.add(e.key);
});

window.addEventListener("keyup", (e) => {
  pressed.delete(e.key);
});

export function isDown(...keys: string[]): boolean {
  return keys.some((k) => pressed.has(k));
}

export function consume(key: string): boolean {
  if (pressed.has(key)) {
    pressed.delete(key);
    return true;
  }
  return false;
}

// --- touch controls -------------------------------------------------------
// Tap-and-hold the left/right half of the canvas to move (mirrors the arrow
// keys), double-tap to jump, swipe right to attack. All three feed into the
// same `pressed` set the keyboard uses, so game.ts doesn't need to know
// which input produced them.

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MAX_DX = 80;
const SWIPE_MIN_DX = 40;
const SWIPE_MAX_DY = 60;
const SWIPE_MAX_MS = 400;

interface TouchStart {
  x: number;
  y: number;
  t: number;
}

const touchZoneKey = new Map<number, string>();
const touchStart = new Map<number, TouchStart>();
let lastTapTime = 0;
let lastTapX = 0;

function getCanvas(): HTMLCanvasElement | null {
  return document.getElementById("game") as HTMLCanvasElement | null;
}

function zoneKeyFor(clientX: number): string {
  const rect = getCanvas()?.getBoundingClientRect();
  const midX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  return clientX < midX ? "ArrowLeft" : "ArrowRight";
}

function injectMomentary(key: string, ms = 90): void {
  pressed.add(key);
  setTimeout(() => pressed.delete(key), ms);
}

window.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const key = zoneKeyFor(t.clientX);
      touchZoneKey.set(t.identifier, key);
      pressed.add(key);
      touchStart.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now() });

      const now = performance.now();
      if (now - lastTapTime < DOUBLE_TAP_MS && Math.abs(t.clientX - lastTapX) < DOUBLE_TAP_MAX_DX) {
        injectMomentary("ArrowUp");
        lastTapTime = 0;
      } else {
        lastTapTime = now;
        lastTapX = t.clientX;
      }
    }
  },
  { passive: false },
);

function endTouch(e: TouchEvent): void {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    const key = touchZoneKey.get(t.identifier);
    if (key) {
      pressed.delete(key);
      touchZoneKey.delete(t.identifier);
    }
    const start = touchStart.get(t.identifier);
    touchStart.delete(t.identifier);
    if (start) {
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = performance.now() - start.t;
      if (dx > SWIPE_MIN_DX && Math.abs(dy) < SWIPE_MAX_DY && dt < SWIPE_MAX_MS) {
        injectMomentary(" ");
      }
    }
  }
}

window.addEventListener("touchend", endTouch, { passive: false });
window.addEventListener("touchcancel", endTouch, { passive: false });
