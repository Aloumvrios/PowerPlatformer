import type { Level } from "./types";

// A single hand-built level. Ground runs the full width; everything else
// is a platform, hazard, power-up or the goal flag floating above it.
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
  ],

  goal: { x: 2300, y: 380, w: 36, h: 60 },
};
