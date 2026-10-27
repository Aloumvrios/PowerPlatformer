import type { Banana, Bean, Level } from "./types";

const BEAN_SIZE = 16;

// A row of beans whose centers start at (x, y) and step by (dx, dy).
function beans(x: number, y: number, n: number, dx = 34, dy = 0): Bean[] {
  return Array.from({ length: n }, (_, i) => ({
    x: x + i * dx - BEAN_SIZE / 2,
    y: y + i * dy - BEAN_SIZE / 2,
    w: BEAN_SIZE,
    h: BEAN_SIZE,
    collected: false,
  }));
}

const BANANA_SIZE = 30;

function banana(cx: number, cy: number): Banana {
  return { x: cx - BANANA_SIZE / 2, y: cy - BANANA_SIZE / 2, w: BANANA_SIZE, h: BANANA_SIZE, collected: false };
}

// A single hand-built level. Ground runs the full width; everything else
// is a platform, hazard, power-up or the goal toilet floating above it.
// Floating platforms are one-way: you pass up through them and land on top.
export const level1: Level = {
  widthPx: 2400,
  heightPx: 540,
  playerStart: { x: 60, y: 440 },

  platforms: [
    { x: 0, y: 500, w: 2400, h: 40 }, // ground
    { x: 260, y: 400, w: 160, h: 20 },
    { x: 500, y: 330, w: 140, h: 20 },
    { x: 720, y: 420, w: 120, h: 20 },
    { x: 940, y: 260, w: 160, h: 20 },
    { x: 1180, y: 380, w: 140, h: 20 },
    { x: 1400, y: 460, w: 400, h: 20 }, // long low run (with a gap + spikes before it)
    { x: 1500, y: 300, w: 120, h: 20 },
    { x: 1700, y: 220, w: 140, h: 20 },
    { x: 1920, y: 340, w: 160, h: 20 },
    { x: 2150, y: 440, w: 200, h: 20 },
  ],

  hazards: [
    { x: 1340, y: 480, w: 60, h: 20 }, // spike pit before the low run
    { x: 2060, y: 480, w: 60, h: 20 },
  ],

  powerUps: [
    { x: 300, y: 360, w: 28, h: 28, kind: "jump", collected: false },
    { x: 980, y: 220, w: 28, h: 28, kind: "speed", collected: false },
    { x: 1540, y: 260, w: 28, h: 28, kind: "shield", collected: false },
    { x: 1230, y: 340, w: 28, h: 28, kind: "fly", collected: false }, // glide over the spike pit + gap ahead
    { x: 1420, y: 420, w: 28, h: 28, kind: "beansoup", collected: false }, // refills Farting Power before the enemy patrol
  ],

  enemies: [
    {
      x: 1550,
      y: 430,
      w: 30,
      h: 30,
      minX: 1430,
      maxX: 1750,
      speed: 90,
      dir: 1,
      alive: true,
    },
  ],

  beans: [
    ...beans(150, 478, 3),
    ...beans(355, 378, 2),
    ...beans(536, 308, 3),
    ...beans(750, 398, 2, 40),
    ...beans(875, 340, 2, 30, -40),
    ...beans(1030, 238, 2),
    ...beans(1000, 478, 3),
    ...beans(1290, 358, 1),
    ...beans(1340, 430, 3, 30, -6), // risky arc over the spike pit
    ...beans(1500, 438, 3, 100),
    ...beans(1545, 278, 2),
    ...beans(1735, 198, 3),
    ...beans(1960, 318, 3, 40),
    ...beans(2180, 418, 2, 34),
  ],

  // Off the main route or over danger, so holding it in costs a detour.
  bananas: [
    banana(570, 262), // big jump up from the first high platform
    banana(1150, 190), // off the end of the high platform, mid-air
    banana(1370, 405), // right over the spike pit
    banana(1990, 255), // above the last high platform
  ],

  checkpoints: [{ x: 1120, y: 440, w: 26, h: 60, reached: false }],

  hints: [
    { x: 70, y: 330, text: "tap: hop toward your finger", mouseText: "click: hop toward the cursor" },
    { x: 300, y: 250, text: "double-tap: BIG jump", mouseText: "double-click: BIG jump" },
    { x: 700, y: 200, text: "hold: fart-fly!", mouseText: "hold the button: fart-fly!" },
    { x: 1000, y: 150, text: "flying burns Farting Power — watch the meter" },
    { x: 420, y: 214, text: "bananas = hold it longer" },
    { x: 1600, y: 400, text: "swipe: fart attack", mouseText: "right-click: fart attack" },
    { x: 2150, y: 300, text: "nature calls →" },
  ],

  goal: { x: 2288, y: 380, w: 46, h: 60 },
};
