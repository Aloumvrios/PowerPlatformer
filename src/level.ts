import type { Banana, Bean, Level, Rect, Stage } from "./types";

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

  solids: [],

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

  decor: [],

  goal: { x: 2288, y: 380, w: 46, h: 60 },
};

// Stage 2 is built from a pen sketch on dotted paper (docs/sketches/stage2.jpg,
// 1500x2000). The
// coordinates below are the sketch's own pixels, so they can be checked
// against the drawing; sk() scales them into the game.
//
// Route: start on the left pillar, jump the pit (an urchin bobs up and down
// across the jump, another patrols the pit), checkpoint on the long block,
// drop off its right end into a tunnel heading left, drop again into the
// bottom tunnel heading right past a crawler, fart-fly up the shaft using the
// small wall ledges (spikes on its walls), come out on top and run left
// along the street to the toilet.
const SK_SCALE = 0.9;
const SK_TOP = 90; // the sketch's y where the level starts

function sk(x1: number, y1: number, x2: number, y2: number): Rect {
  const x = Math.round(x1 * SK_SCALE);
  const y = Math.round((y1 - SK_TOP) * SK_SCALE);
  return { x, y, w: Math.round(x2 * SK_SCALE) - x, h: Math.round((y2 - SK_TOP) * SK_SCALE) - y };
}

// Sketch-coordinate point → game coordinates.
const skX = (x: number) => Math.round(x * SK_SCALE);
const skY = (y: number) => Math.round((y - SK_TOP) * SK_SCALE);

export const level2: Level = {
  widthPx: skX(1500),
  heightPx: skY(1950),
  playerStart: { x: skX(100), y: skY(1350) - 44 },

  platforms: [],

  solids: [
    sk(0, 90, 1500, 185), // top edge of the page
    sk(1450, 185, 1500, 1950), // right wall
    sk(0, 860, 1100, 955), // the street (top floor)
    // The sloped bank between the street and the shaft, as three steps.
    sk(1100, 805, 1150, 1620),
    sk(1150, 890, 1200, 1620),
    sk(1200, 975, 1250, 1620),
    sk(0, 1350, 230, 1950), // start pillar
    sk(230, 1780, 455, 1950), // pit floor
    sk(455, 1345, 995, 1450), // checkpoint block
    sk(455, 1450, 555, 1950), // ...and its left side, down to the bottom
    sk(660, 1585, 1100, 1640), // floor of the upper tunnel
    sk(555, 1790, 1450, 1950), // floor of the bottom tunnel and the shaft
    // Shaft ledges, alternating walls, from the bottom up.
    sk(1395, 1490, 1450, 1540),
    sk(1250, 1390, 1305, 1435),
    sk(1395, 1285, 1450, 1330),
    sk(1250, 1180, 1305, 1225),
    sk(1395, 1075, 1450, 1120),
  ],

  hazards: [
    { ...sk(230, 1755, 455, 1780), dir: "up" }, // bottom of the pit
    { ...sk(250, 955, 430, 982), dir: "down" }, // hanging under the street
    { ...sk(1420, 1600, 1450, 1730), dir: "left" }, // shaft, right wall
    { ...sk(1250, 1525, 1275, 1585), dir: "right" }, // shaft, left wall
  ],

  powerUps: [{ x: skX(1340) - 14, y: skY(1790) - 30, w: 28, h: 28, kind: "beansoup", collected: false }], // fuel for the climb

  enemies: [
    // Bobs up and down across the jump over the pit.
    { x: skX(330), y: skY(1080), w: 30, h: 30, minX: skY(1080), maxX: skY(1330), speed: 70, dir: 1, alive: true, axis: "y" },
    // Patrols the pit.
    { x: skX(250), y: skY(1690), w: 30, h: 30, minX: skX(250), maxX: skX(420) - 30, speed: 60, dir: 1, alive: true },
    // Crawls along the bottom tunnel.
    { x: skX(600), y: skY(1790) - 28, w: 44, h: 28, minX: skX(600), maxX: skX(1180) - 44, speed: 70, dir: 1, alive: true, kind: "crawler" },
  ],

  beans: [
    ...beans(skX(290), skY(1250), 3, 45, -8), // over the pit
    ...beans(skX(560), skY(1345) - 20, 3, 40), // checkpoint block
    ...beans(skX(760), skY(1585) - 20, 4, 50), // upper tunnel
    ...beans(skX(620), skY(1790) - 20, 3, 40), // bottom tunnel
    ...beans(skX(1280), skY(1390) - 20, 1), // shaft ledges
    ...beans(skX(1420), skY(1285) - 20, 1),
    ...beans(skX(330), skY(860) - 20, 4, 55), // the street
  ],

  bananas: [
    banana(skX(1280), skY(1180) - 22), // on a shaft ledge
    banana(skX(900), skY(860) - 60), // above the street
  ],

  checkpoints: [{ x: skX(640), y: skY(1345) - 60, w: 26, h: 60, reached: false }],

  hints: [
    { x: skX(70), y: skY(1150), text: "START" },
    { x: skX(1000), y: skY(1690), text: "fly up →" },
    { x: skX(70), y: skY(650), text: "END" },
  ],

  decor: [
    { ...sk(55, 1210, 160, 1350), kind: "door" },
    { ...sk(55, 380, 615, 860), kind: "hall" },
    { ...sk(255, 590, 355, 860), kind: "wc" },
    { ...sk(615, 350, 815, 860), kind: "house" },
  ],

  goal: { x: skX(80), y: skY(860) - 60, w: 46, h: 60 },
};

// Every stage, in play order. Adding one here is all the game needs; its
// Easy/Medium/Hard values come from `npm run sim -- tune` (until then it
// plays with DEFAULT_TUNING, and the difficulty check fails as "untuned").
export const STAGES: Stage[] = [
  { id: "stage1", name: "Stage 1", level: level1 },
  { id: "stage2", name: "Stage 2", level: level2 },
];
