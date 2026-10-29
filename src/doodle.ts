// "Notebook doodle" drawing helpers: everything in the world except the
// player sprite is drawn here as wobbly pencil-on-paper canvas paths.
//
// Wobble is seeded, not random per frame, so shapes hold still — except for
// a deliberate "line boil": the seed cycles through 3 variations a few times
// a second (setBoil), the classic hand-animated look where outlines shimmer.

import type { Checkpoint, Decor, Enemy, Hazard, PickupKind, Rect } from "./types";
import { VIEW_H, VIEW_W } from "./view";

export const INK = "#26262e";
export const PAPER = "#fbf7ea";
export const PAPER_LINE = "#a9c6e8";
export const MARGIN_LINE = "#e79b9b";
export const HAND_FONT = "'Patrick Hand', 'Comic Sans MS', cursive";
export const MARKER_FONT = "'Permanent Marker', 'Comic Sans MS', cursive";

let boilFrame = 0;

export function setBoil(t: number): void {
  boilFrame = Math.floor(t * 7) % 3;
}

// Small seeded PRNG (mulberry32); the seed mixes in the boil frame.
function rng(seed: number): () => number {
  let a = (Math.floor(seed * 9301) ^ (boilFrame * 49297)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Same as rng but ignores line boil — for layout that must not move
// (cloud positions, grass tufts).
function stableRng(seed: number): () => number {
  let a = Math.floor(seed * 7919) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A pencil stroke from (x1,y1) to (x2,y2), bowed slightly and overshooting
// the ends a touch, the way a quick hand-drawn line does.
export function sketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  jitter = 1.4,
): void {
  const r = rng(seed);
  const j = () => (r() - 0.5) * 2 * jitter;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const over = 0.03;
  ctx.beginPath();
  ctx.moveTo(x1 - dx * over * r() + j(), y1 - dy * over * r() + j());
  ctx.quadraticCurveTo(
    x1 + dx * 0.5 + j() * 1.5,
    y1 + dy * 0.5 + j() * 1.5,
    x2 + dx * over * r() + j(),
    y2 + dy * over * r() + j(),
  );
  ctx.stroke();
}

// Outline a rectangle with two slightly different pencil passes.
export function sketchRect(ctx: CanvasRenderingContext2D, r: Rect, seed: number, jitter = 1.4): void {
  for (let pass = 0; pass < 2; pass++) {
    const s = seed + pass * 101;
    sketchLine(ctx, r.x, r.y, r.x + r.w, r.y, s + 1, jitter);
    sketchLine(ctx, r.x + r.w, r.y, r.x + r.w, r.y + r.h, s + 2, jitter);
    sketchLine(ctx, r.x + r.w, r.y + r.h, r.x, r.y + r.h, s + 3, jitter);
    sketchLine(ctx, r.x, r.y + r.h, r.x, r.y, s + 4, jitter);
  }
}

// A wobbly closed loop around (cx,cy) — circles, blobs, clouds' lobes.
export function sketchCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  wobble = 0.08,
  fill?: string,
): void {
  const rnd = rng(seed);
  const n = 10;
  const pts: [number, number][] = [];
  const start = rnd() * Math.PI * 2;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2.08; // slight overlap at the join
    const rr = r * (1 + (rnd() - 0.5) * 2 * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
}

// Diagonal pencil hatching clipped to a rect.
export function hatch(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  seed: number,
  color: string,
  gap = 9,
  alpha = 0.35,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = 1.2;
  for (let x = r.x - r.h; x < r.x + r.w; x += gap) {
    sketchLine(ctx, x, r.y + r.h + 2, x + r.h + 2, r.y - 2, seed + x, 1);
  }
  ctx.restore();
}

// --- background ----------------------------------------------------------

// Lined notebook paper filling the view, plus a margin line and faint
// pencil doodles (sun, clouds, hills) on two parallax layers. In a level
// taller than the view, the doodles sit at the bottom of the level and
// slide down out of sight (by parallax) as the camera climbs.
export function drawPaper(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, levelW: number, levelH: number): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = PAPER_LINE;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  const firstLine = 72 - cameraY > 0 ? 72 - cameraY : (((72 - cameraY) % 30) + 30) % 30;
  for (let y = firstLine; y < VIEW_H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW_W, y + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Margin line, pinned to the start of the level like a page edge.
  const marginX = 46 - cameraX;
  if (marginX > -4) {
    ctx.strokeStyle = MARGIN_LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, 0);
    ctx.lineTo(marginX, VIEW_H);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.22;
  const above = Math.max(0, levelH - VIEW_H - cameraY); // how far the camera is above the level's bottom
  ctx.translate(0, above * 0.04);

  // Sun, barely moving.
  const sunX = 820 - cameraX * 0.04;
  sketchCircle(ctx, sunX, 70, 26, 7, 0.05);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    sketchLine(ctx, sunX + Math.cos(a) * 34, 70 + Math.sin(a) * 34, sunX + Math.cos(a) * 46, 70 + Math.sin(a) * 46, 70 + i, 1);
  }

  // Far layer: clouds.
  ctx.translate(0, above * 0.21);
  drawParallaxLayer(cameraX, 0.25, levelW, 360, (x, seed) => {
    const r = stableRng(seed);
    drawCloud(ctx, x, 70 + r() * 90, 0.7 + r() * 0.5, seed);
  });

  // Near layer: rolling hills with a few trees.
  ctx.translate(0, above * 0.25);
  drawParallaxLayer(cameraX, 0.5, levelW, 300, (x, seed) => {
    const r = stableRng(seed);
    const h = 60 + r() * 60;
    const base = 500;
    ctx.beginPath();
    ctx.moveTo(x - 30, base);
    ctx.quadraticCurveTo(x + 150, base - h * 2, x + 330, base);
    ctx.stroke();
    if (r() < 0.6) {
      // Plant the tree on the hill's curve (the quadratic's apex is h high).
      const tx = x + 60 + r() * 180;
      const u = (tx - (x + 150)) / 180;
      const groundY = base - h * Math.max(0, 1 - u * u);
      sketchLine(ctx, tx, groundY, tx, groundY - 30, seed + 5, 0.8);
      sketchCircle(ctx, tx, groundY - 46, 18, seed + 6, 0.15);
    }
  });
  ctx.restore();
}

function drawParallaxLayer(
  cameraX: number,
  factor: number,
  levelW: number,
  spacing: number,
  draw: (x: number, seed: number) => void,
): void {
  const offset = cameraX * factor;
  const span = VIEW_W + (levelW - VIEW_W) * factor;
  for (let i = -1; i * spacing < span + spacing; i++) {
    const x = i * spacing - offset;
    if (x < -spacing * 1.5 || x > VIEW_W + spacing * 0.5) continue;
    draw(x, i * 31 + factor * 1000);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  sketchCircle(ctx, x, y, 22 * s, seed, 0.1);
  sketchCircle(ctx, x + 26 * s, y - 10 * s, 28 * s, seed + 1, 0.1);
  sketchCircle(ctx, x + 56 * s, y, 22 * s, seed + 2, 0.1);
}

// --- level pieces ----------------------------------------------------------

export function drawPlatform(ctx: CanvasRenderingContext2D, r: Rect, seed: number, isGround: boolean): void {
  ctx.save();
  ctx.fillStyle = isGround ? "#efe6cf" : "#f0e7cc";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  hatch(ctx, r, seed, INK, isGround ? 11 : 8, isGround ? 0.22 : 0.3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  if (isGround) {
    // The ground is long; sketch its top edge in short segments so the
    // wobble stays local instead of one giant bow.
    for (let x = r.x; x < r.x + r.w; x += 120) {
      sketchLine(ctx, x, r.y, Math.min(x + 124, r.x + r.w), r.y, seed + x, 1.2);
    }
  } else {
    sketchRect(ctx, r, seed);
  }
  // Grass tufts along the top.
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "#4b7a3a";
  const tr = stableRng(seed + 3);
  for (let x = r.x + 6 + tr() * 20; x < r.x + r.w - 6; x += 22 + tr() * 40) {
    for (let k = -1; k <= 1; k++) {
      sketchLine(ctx, x + k * 3, r.y, x + k * 5, r.y - 5 - tr() * 4, seed + x + k, 0.5);
    }
  }
  ctx.restore();
}

// A row of spikes filling `r`, pointing `dir` (up from a floor, down from
// a ceiling, or sideways out of a wall).
export function drawSpikes(ctx: CanvasRenderingContext2D, r: Rect, seed: number, dir: Hazard["dir"] = "up"): void {
  ctx.save();
  const vertical = dir === "up" || dir === "down";
  const len = vertical ? r.w : r.h;
  const n = Math.max(2, Math.round(len / 15));
  const w = len / n;
  ctx.strokeStyle = "#c62f2f";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(226, 59, 59, 0.28)";
  for (let i = 0; i < n; i++) {
    const a0 = i * w;
    const rr = rng(seed + i);
    const along = a0 + w / 2 + (rr() - 0.5) * 2;
    const wob = (rr() - 0.5) * 2;
    // [base corner 1, tip, base corner 2] in level coordinates.
    let pts: [number, number][];
    switch (dir) {
      case "down":
        pts = [[r.x + a0, r.y], [r.x + along, r.y + r.h + 4 + wob], [r.x + a0 + w, r.y]];
        break;
      case "left":
        pts = [[r.x + r.w, r.y + a0], [r.x - 4 + wob, r.y + along], [r.x + r.w, r.y + a0 + w]];
        break;
      case "right":
        pts = [[r.x, r.y + a0], [r.x + r.w + 4 + wob, r.y + along], [r.x, r.y + a0 + w]];
        break;
      default:
        pts = [[r.x + a0, r.y + r.h], [r.x + along, r.y - 4 + wob], [r.x + a0 + w, r.y + r.h]];
    }
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Solid terrain: a block shaded with dense diagonal pencil hatching, like
// the hatched ground in a level sketch. Long edges are drawn in short
// segments so the wobble stays local.
export function drawSolid(ctx: CanvasRenderingContext2D, r: Rect, seed: number): void {
  ctx.save();
  ctx.fillStyle = "#ece2c8";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  hatch(ctx, r, seed, INK, 13, 0.32);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const edge = (x0: number, y0: number, x1: number, y1: number, s: number) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 120));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      sketchLine(ctx, x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, s + i, 0.9);
    }
  };
  edge(r.x, r.y, r.x + r.w, r.y, seed + 1);
  edge(r.x + r.w, r.y, r.x + r.w, r.y + r.h, seed + 50);
  edge(r.x + r.w, r.y + r.h, r.x, r.y + r.h, seed + 100);
  edge(r.x, r.y + r.h, r.x, r.y, seed + 150);
  ctx.restore();
}

// Background scenery: pencil buildings and doors. Purely decorative.
export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, seed: number): void {
  const { x, y, w, h } = d;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "rgba(251, 247, 234, 0.9)";
  const knob = (kx: number, ky: number, r: number) => {
    ctx.beginPath();
    ctx.arc(kx, ky, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  switch (d.kind) {
    case "hall": {
      // A long building whose roof is rows of scalloped tiles.
      ctx.fillRect(x, y, w, h);
      sketchRect(ctx, d, seed, 1);
      const rows = 3;
      const roofH = h * 0.45;
      for (let row = 0; row < rows; row++) {
        const ry = y + ((row + 1) * roofH) / rows;
        sketchLine(ctx, x, ry, x + w, ry, seed + 10 + row, 0.8);
        const n = Math.max(3, Math.round(w / 55));
        const aw = w / n;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.arc(x + aw * (i + 0.5), ry, aw / 2, Math.PI, 0);
          ctx.stroke();
        }
      }
      break;
    }
    case "house": {
      // Pitched roof on a box, with a door.
      const roofH = h * 0.32;
      ctx.beginPath();
      ctx.moveTo(x, y + roofH);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w, y + roofH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const body: Rect = { x: x + w * 0.04, y: y + roofH, w: w * 0.92, h: h - roofH };
      ctx.fillRect(body.x, body.y, body.w, body.h);
      sketchRect(ctx, body, seed, 1);
      const door: Rect = { x: x + w * 0.45, y: y + h * 0.66, w: w * 0.3, h: h * 0.34 };
      sketchRect(ctx, door, seed + 5, 0.8);
      knob(door.x + door.w * 0.25, door.y + door.h * 0.5, 3);
      break;
    }
    case "wc": {
      // A tall narrow door marked WC.
      ctx.fillRect(x, y, w, h);
      sketchRect(ctx, d, seed, 1);
      sketchRect(ctx, { x: x + w * 0.15, y: y + h * 0.04, w: w * 0.7, h: h * 0.96 }, seed + 3, 0.8);
      ctx.globalAlpha = 1;
      handText(ctx, "WC", x + w / 2, y + h * 0.18, Math.min(26, w * 0.45), INK, { font: MARKER_FONT });
      ctx.globalAlpha = 0.75;
      knob(x + w * 0.3, y + h * 0.62, 4);
      break;
    }
    case "door": {
      // An open door frame with an arrow pointing out of it: the way in.
      sketchLine(ctx, x, y + h, x, y, seed, 0.8);
      sketchLine(ctx, x, y, x + w * 0.6, y, seed + 1, 0.8);
      sketchLine(ctx, x + w * 0.6, y, x + w * 0.6, y + h, seed + 2, 0.8);
      ctx.lineWidth = 2;
      const ay = y + h * 0.55;
      sketchLine(ctx, x + w * 0.1, ay, x + w, ay, seed + 3, 0.6);
      sketchLine(ctx, x + w, ay, x + w - 10, ay - 7, seed + 4, 0.4);
      sketchLine(ctx, x + w, ay, x + w - 10, ay + 7, seed + 5, 0.4);
      break;
    }
  }
  ctx.restore();
}

// The goal: a doodled toilet with stink lines. `flush` (0..1) swirls the
// water during the win animation.
export function drawToilet(ctx: CanvasRenderingContext2D, r: Rect, t: number, flush = 0): void {
  const { x, y, w, h } = r;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillStyle = "#ffffff";

  // Tank
  const tank: Rect = { x: x + w * 0.52, y, w: w * 0.42, h: h * 0.5 };
  ctx.fillRect(tank.x, tank.y, tank.w, tank.h);
  sketchRect(ctx, tank, 501, 1);
  sketchLine(ctx, tank.x + tank.w * 0.15, tank.y + 8, tank.x + tank.w * 0.5, tank.y + 8, 502, 0.5); // handle

  // Bowl
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.48);
  ctx.lineTo(x + w * 0.6, y + h * 0.48);
  ctx.quadraticCurveTo(x + w * 0.62, y + h * 0.8, x + w * 0.38, y + h * 0.82);
  ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.8, x, y + h * 0.48);
  ctx.fill();
  ctx.stroke();
  // Water
  ctx.fillStyle = "#9fd3f0";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.53, w * 0.22, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flush > 0) {
    ctx.strokeStyle = "#3b8fc4";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.3) {
      const rr = (a / (Math.PI * 4)) * w * 0.2;
      const px = x + w * 0.3 + Math.cos(a + t * 14) * rr;
      const py = y + h * 0.53 + Math.sin(a + t * 14) * rr * 0.25;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
  }
  // Seat rim
  sketchLine(ctx, x - 3, y + h * 0.48, x + w * 0.62, y + h * 0.48, 503, 0.6);
  // Pedestal
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.8);
  ctx.lineTo(x + w * 0.16, y + h);
  ctx.lineTo(x + w * 0.6, y + h);
  ctx.lineTo(x + w * 0.52, y + h * 0.8);
  ctx.fill();
  ctx.stroke();

  // Stink lines
  ctx.strokeStyle = "#7aa34a";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    const sx = x + w * (0.12 + i * 0.16);
    const phase = t * 3 + i * 1.7;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const yy = y + h * 0.42 - k * 3;
      const xx = sx + Math.sin(phase + k * 0.7) * 3;
      if (k === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCheckpoint(ctx: CanvasRenderingContext2D, cp: Checkpoint, t: number, raise: number): void {
  const poleX = cp.x + 4;
  const top = cp.y;
  const bottom = cp.y + cp.h;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  sketchLine(ctx, poleX, bottom, poleX, top, 601, 0.8);
  // Flag slides from the bottom of the pole to the top as `raise` -> 1.
  const flagTop = bottom - 22 - (cp.h - 22) * raise;
  const wave = Math.sin(t * 6) * 3 * (0.3 + raise);
  ctx.fillStyle = cp.reached ? "#7cc35a" : "#d9d2bd";
  ctx.beginPath();
  ctx.moveTo(poleX, flagTop);
  ctx.quadraticCurveTo(poleX + 12, flagTop + wave, poleX + 24, flagTop + 7 + wave);
  ctx.quadraticCurveTo(poleX + 12, flagTop + 12 - wave, poleX, flagTop + 15);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

// --- pickups -----------------------------------------------------------------

export function pickupColor(kind: PickupKind): string {
  switch (kind) {
    case "speed":
      return "#f2b705";
    case "jump":
      return "#3b82f6";
    case "shield":
      return "#16b5cf";
    case "fly":
      return "#8b6cf0";
    case "beansoup":
      return "#c26a12";
  }
}

export function pickupLabel(kind: PickupKind): string {
  switch (kind) {
    case "speed":
      return "SPEEDY HOPS!";
    case "jump":
      return "SUPER JUMP!";
    case "shield":
      return "SHIELD!";
    case "fly":
      return "WINGS!";
    case "beansoup":
      return "BEAN SOUP! FULL TANK!";
  }
}

// A pickup's icon centred at (cx,cy) with radius-ish size s. Used both in
// the world and (small) in the HUD.
export function drawPickupIcon(
  ctx: CanvasRenderingContext2D,
  kind: PickupKind,
  cx: number,
  cy: number,
  s: number,
  seed: number,
): void {
  const color = pickupColor(kind);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, s * 0.12);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (kind) {
    case "speed": {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.25, cy - s);
      ctx.lineTo(cx - s * 0.55, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.02, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.3, cy + s);
      ctx.lineTo(cx + s * 0.6, cy - s * 0.2);
      ctx.lineTo(cx + s * 0.05, cy - s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "jump": {
      // A spring: zig-zag coil between two plates.
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, s * 0.16);
      ctx.beginPath();
      const turns = 4;
      for (let i = 0; i <= turns * 2; i++) {
        const yy = cy + s * 0.65 - (i / (turns * 2)) * s * 1.3;
        const xx = cx + (i % 2 === 0 ? -1 : 1) * s * 0.55;
        if (i === 0) ctx.moveTo(cx - s * 0.55, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, s * 0.14);
      sketchLine(ctx, cx - s * 0.8, cy + s * 0.8, cx + s * 0.8, cy + s * 0.8, seed, 0.5);
      sketchLine(ctx, cx - s * 0.8, cy - s * 0.8, cx + s * 0.8, cy - s * 0.8, seed + 1, 0.5);
      break;
    }
    case "shield": {
      ctx.globalAlpha = 0.85;
      sketchCircle(ctx, cx, cy, s * 0.9, seed, 0.06, "rgba(22, 181, 207, 0.35)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.5, s * 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.55, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
      break;
    }
    case "fly": {
      drawWing(ctx, cx - s * 0.35, cy, s * 0.75, color, false);
      drawWing(ctx, cx + s * 0.35, cy, s * 0.75, color, true);
      break;
    }
    case "beansoup": {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.95, cy - s * 0.05);
      ctx.quadraticCurveTo(cx, cy + s * 1.3, cx + s * 0.95, cy - s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      for (const [bx, by] of [
        [-0.45, 0.05],
        [0, 0.12],
        [0.42, 0.04],
      ]) {
        ctx.beginPath();
        ctx.ellipse(cx + bx * s, cy + by * s, s * 0.2, s * 0.12, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#7aa34a";
      ctx.lineWidth = Math.max(1, s * 0.1);
      for (const ox of [-0.25, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(cx + ox * s, cy - s * 0.25);
        ctx.quadraticCurveTo(cx + (ox - 0.2) * s, cy - s * 0.6, cx + ox * s, cy - s);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// One wing; `flip` mirrors it so a pair can sit either side of something.
export function drawWing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string,
  flip: boolean,
  flap = 0,
): void {
  const d = flip ? 1 : -1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(d * flap * 0.5);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(d * s * 0.6, -s * 1.1, d * s * 1.2, -s * 0.7);
  ctx.quadraticCurveTo(d * s * 0.95, -s * 0.3, d * s * 1.05, -s * 0.15);
  ctx.quadraticCurveTo(d * s * 0.7, 0, d * s * 0.8, s * 0.25);
  ctx.quadraticCurveTo(d * s * 0.4, s * 0.25, 0, 0);
  ctx.closePath();
  ctx.globalAlpha *= 0.85;
  ctx.fill();
  ctx.globalAlpha /= 0.85;
  ctx.stroke();
  ctx.restore();
}

export function drawBean(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, angle: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = "#b5552a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  // Kidney shape: an ellipse with a pinched top.
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.bezierCurveTo(-s, -s * 0.9, -s * 0.2, -s * 0.8, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.2, -s * 0.8, s, -s * 0.9, s, 0);
  ctx.bezierCurveTo(s, s * 0.8, -s, s * 0.8, -s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.45, -s * 0.15, s * 0.22, s * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A curved banana: a crescent with brown tips and a hatch-shaded inner edge.
export function drawBanana(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, angle: number, seed: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, s * 0.08);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = "#f5d33b";
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.45);
  ctx.quadraticCurveTo(-s * 0.15, s * 1.25, s * 0.95, -s * 0.5);
  ctx.quadraticCurveTo(0, s * 0.2, -s, -s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hatched shadow along the belly, then a ridge line.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#e0a91f";
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.15, s * 1.25, s * 0.95, -s * 0.25);
  ctx.lineTo(s, s);
  ctx.lineTo(-s, s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.1, s * 0.75, s * 0.7, -s * 0.3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Stem and tip.
  ctx.strokeStyle = "#6b4a1e";
  ctx.lineWidth = Math.max(1.5, s * 0.16);
  sketchLine(ctx, s * 0.9, -s * 0.5, s * 1.08, -s * 0.8, seed, 0.3);
  ctx.fillStyle = "#6b4a1e";
  ctx.beginPath();
  ctx.arc(-s * 0.98, -s * 0.45, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- enemy ---------------------------------------------------------------

// A spiky, bobbing urchin whose eyes follow the player. `squash` (0..1)
// flattens it as it dies.
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  t: number,
  lookX: number,
  lookY: number,
  seed: number,
  squash = 0,
): void {
  if (enemy.kind === "crawler") {
    drawCrawler(ctx, enemy, t, lookX, lookY, seed, squash);
    return;
  }
  const cx = enemy.x + enemy.w / 2;
  const bob = Math.sin(t * 4 + enemy.x * 0.05) * 3 * (1 - squash);
  const cy = enemy.y + enemy.h / 2 + bob + squash * enemy.h * 0.3;
  const r = enemy.w / 2;
  const spikes = 9;
  const spin = t * 1.5 * enemy.dir;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1 + squash * 0.5, 1 - squash * 0.6);
  const rr = rng(seed);
  ctx.fillStyle = "#e86a7d";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = spin + (Math.PI * i) / spikes;
    const rad = (i % 2 === 0 ? r * 1.05 : r * 0.62) + (rr() - 0.5) * 2;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eyes, pupils shifted toward the player.
  const look = Math.atan2(lookY - cy, lookX - cx);
  const px = Math.cos(look) * r * 0.08;
  const py = Math.sin(look) * r * 0.08;
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 1.2;
  for (const ex of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.arc(ex * r, -r * 0.08, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  for (const ex of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.arc(ex * r + px, -r * 0.08 + py, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grumpy brows
  ctx.lineWidth = 1.8;
  sketchLine(ctx, -r * 0.48, -r * 0.4, -r * 0.1, -r * 0.28, seed + 1, 0.4);
  sketchLine(ctx, r * 0.48, -r * 0.4, r * 0.1, -r * 0.28, seed + 2, 0.4);
  ctx.restore();
}

// A dark dome on scuttling legs that walks along the floor; eyes follow the player.
function drawCrawler(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  t: number,
  lookX: number,
  lookY: number,
  seed: number,
  squash: number,
): void {
  const cx = enemy.x + enemy.w / 2;
  const base = enemy.y + enemy.h;
  const r = enemy.w / 2;
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(1 + squash * 0.5, 1 - squash * 0.6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  // Legs: three a side, stepping.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const phase = Math.sin(t * 14 + i * 2.1 + (side > 0 ? 1 : 0)) * 3;
      const hipX = side * r * (0.35 + i * 0.2);
      const kneeX = side * r * (0.75 + i * 0.25);
      const footX = side * r * (0.95 + i * 0.22) + phase;
      sketchLine(ctx, hipX, -enemy.h * 0.35, kneeX, -enemy.h * 0.85, seed + i + side * 7, 0.3);
      sketchLine(ctx, kneeX, -enemy.h * 0.85, footX, 0, seed + i + side * 9, 0.3);
    }
  }
  // Body
  ctx.fillStyle = "#3a3540";
  ctx.beginPath();
  ctx.ellipse(0, -enemy.h * 0.4, r * 0.8, enemy.h * 0.55, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eyes
  const ey = -enemy.h * 0.55;
  const look = Math.atan2(lookY - (base + ey), lookX - cx);
  for (const ex of [-0.3, 0.3]) {
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ex * r, ey, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex * r + Math.cos(look) * r * 0.08, ey + Math.sin(look) * r * 0.08, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- stalls -----------------------------------------------------------------

// The pants-insurance salesperson: a stick figure in a tie with a briefcase,
// standing with feet at (x, bottom), facing `dir`. Gestures while talking.
export function drawSalesperson(ctx: CanvasRenderingContext2D, x: number, bottom: number, t: number, talking: boolean, dir: 1 | -1): void {
  ctx.save();
  ctx.translate(x, bottom);
  ctx.scale(dir, 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bob = talking ? Math.sin(t * 9) * 1.5 : Math.sin(t * 2) * 0.8;
  const hipY = -26;
  const neckY = -46 + bob;
  // Legs
  sketchLine(ctx, 0, hipY, -6, 0, 1900, 0.4);
  sketchLine(ctx, 0, hipY, 6, 0, 1901, 0.4);
  // Body
  sketchLine(ctx, 0, neckY, 0, hipY, 1902, 0.4);
  // Tie
  ctx.fillStyle = "#c62f2f";
  ctx.beginPath();
  ctx.moveTo(-2, neckY + 2);
  ctx.lineTo(2, neckY + 2);
  ctx.lineTo(3, neckY + 13);
  ctx.lineTo(0, neckY + 16);
  ctx.lineTo(-3, neckY + 13);
  ctx.closePath();
  ctx.fill();
  // Back arm holds the briefcase
  sketchLine(ctx, 0, neckY + 4, -9, hipY + 2, 1903, 0.4);
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(-17, hipY + 2, 15, 11);
  ctx.strokeRect(-17, hipY + 2, 15, 11);
  sketchLine(ctx, -12, hipY + 2, -12, hipY - 1, 1904, 0.2);
  sketchLine(ctx, -12, hipY - 1, -7, hipY - 1, 1905, 0.2);
  sketchLine(ctx, -7, hipY - 1, -7, hipY + 2, 1906, 0.2);
  // Front arm waves while pitching
  const wave = talking ? Math.sin(t * 7) * 0.6 : 0.2;
  sketchLine(ctx, 0, neckY + 4, 12 * Math.cos(wave - 0.6), neckY + 4 - 12 * Math.sin(wave - 0.6), 1907, 0.4);
  // Head with slicked hair and a big grin
  ctx.fillStyle = "#fbf7ea";
  ctx.beginPath();
  ctx.arc(0, neckY - 9, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, neckY - 11, 9, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(3, neckY - 7, 4, 0.1, Math.PI - 0.6);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(4, neckY - 11, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A locked wooden door filling `r` (padlock, keyhole, planks); rattles while
// `unlocking` is a time, and once `open` is just its frame with the door
// swung back against it.
export function drawLockedDoor(ctx: CanvasRenderingContext2D, r: Rect, open: boolean, unlocking: number | null): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  if (open) {
    // Frame posts and the door folded back flat against the hinge side.
    sketchLine(ctx, r.x, r.y, r.x, r.y + r.h, 1960, 0.6);
    sketchLine(ctx, r.x + r.w, r.y, r.x + r.w, r.y + r.h, 1961, 0.6);
    ctx.fillStyle = "#c8a06a";
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + 4);
    ctx.lineTo(r.x - r.w * 0.9, r.y + 12);
    ctx.lineTo(r.x - r.w * 0.9, r.y + r.h - 6);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  const shake = unlocking !== null ? Math.sin(unlocking * 45) * 1.2 : 0;
  ctx.translate(shake, 0);
  ctx.fillStyle = "#c8a06a";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  hatch(ctx, r, 1962, "#8a5a2b", 7, 0.35);
  sketchRect(ctx, r, 1963, 0.8);
  // Planks
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) sketchLine(ctx, r.x + 2, r.y + (r.h * i) / 3, r.x + r.w - 2, r.y + (r.h * i) / 3, 1964 + i, 0.4);
  // Padlock on the side you approach from (left), with its shackle.
  const lx = r.x - 4;
  const ly = r.y + r.h * 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly - 6, 5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#f2b705";
  ctx.fillRect(lx - 7, ly - 6, 14, 12);
  ctx.strokeRect(lx - 7, ly - 6, 14, 12);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(lx, ly - 1, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(lx - 0.8, ly - 1, 1.6, 4);
  ctx.restore();
}

// A hand-drawn speech bubble whose tail points down at (x, y); `text` is
// wrapped to `maxW`.
export function drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, maxW: number): void {
  ctx.save();
  const size = 17;
  ctx.font = `${size}px ${HAND_FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW - 20 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22);
  const h = lines.length * (size + 2) + 14;
  const box: Rect = { x: x - w / 2, y: y - h - 12, w, h };
  ctx.fillStyle = "#fffdf5";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  sketchRect(ctx, box, 1950, 1);
  ctx.beginPath();
  ctx.moveTo(x - 8, box.y + box.h);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 6, box.y + box.h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  lines.forEach((l, i) => handText(ctx, l, x, box.y + 7 + (size + 2) * (i + 0.5), size, INK));
}

// --- HUD bits ------------------------------------------------------------

export function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, full: boolean, seed: number): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.75);
  ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75);
  ctx.closePath();
  if (full) {
    ctx.fillStyle = "#e5484d";
    ctx.fill();
  }
  ctx.stroke();
  if (!full) {
    ctx.globalAlpha = 0.5;
    sketchLine(ctx, cx - s * 0.5, cy - s * 0.4, cx + s * 0.5, cy + s * 0.4, seed, 0.5);
  }
  ctx.restore();
}

// A little fart cloud, used as a HUD label and in the title card.
export function drawPuffIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, seed: number): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  const fill = "#cfe6a6";
  sketchCircle(ctx, cx - s * 0.45, cy + s * 0.1, s * 0.45, seed, 0.1, fill);
  sketchCircle(ctx, cx + s * 0.1, cy - s * 0.2, s * 0.55, seed + 1, 0.1, fill);
  sketchCircle(ctx, cx + s * 0.55, cy + s * 0.15, s * 0.4, seed + 2, 0.1, fill);
  ctx.restore();
}

export type ButtonIcon = "pause" | "play" | "sound" | "muted" | "fullscreen";

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, icon: ButtonIcon, seed: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(251, 247, 234, 0.85)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  sketchRect(ctx, r, seed, 1);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = r.w * 0.22;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  switch (icon) {
    case "pause":
      ctx.fillRect(cx - s * 0.9, cy - s, s * 0.6, s * 2);
      ctx.fillRect(cx + s * 0.3, cy - s, s * 0.6, s * 2);
      break;
    case "play":
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.7, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx - s * 0.7, cy + s);
      ctx.closePath();
      ctx.fill();
      break;
    case "sound":
    case "muted": {
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.2, cy - s * 0.4);
      ctx.lineTo(cx - s * 0.6, cy - s * 0.4);
      ctx.lineTo(cx, cy - s);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.6, cy + s * 0.4);
      ctx.lineTo(cx - s * 1.2, cy + s * 0.4);
      ctx.closePath();
      ctx.fill();
      if (icon === "sound") {
        ctx.beginPath();
        ctx.arc(cx + s * 0.2, cy, s * 0.6, -0.9, 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.2, cy, s * 1.1, -0.9, 0.9);
        ctx.stroke();
      } else {
        sketchLine(ctx, cx + s * 0.4, cy - s * 0.6, cx + s * 1.3, cy + s * 0.6, seed + 9, 0.3);
        sketchLine(ctx, cx + s * 1.3, cy - s * 0.6, cx + s * 0.4, cy + s * 0.6, seed + 10, 0.3);
      }
      break;
    }
    case "fullscreen": {
      const k = s * 1.1;
      const c = s * 0.6;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * k, cy + sy * (k - c));
        ctx.lineTo(cx + sx * k, cy + sy * k);
        ctx.lineTo(cx + sx * (k - c), cy + sy * k);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// Hand-lettered text: a slight per-word wobble in angle so it doesn't look
// typeset. Drawn centred at (x, y) unless `align` says otherwise.
// A labelled paper button, e.g. the difficulty picker; the selected one is
// highlighted and lettered in marker.
export function drawTextButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  selected: boolean,
  seed: number,
): void {
  ctx.save();
  ctx.fillStyle = selected ? "rgba(242, 201, 76, 0.9)" : "rgba(251, 247, 234, 0.85)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = selected ? 2.6 : 1.6;
  sketchRect(ctx, r, seed, 1);
  ctx.restore();
  handText(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, selected ? 22 : 22, selected ? INK : "#4a4a5c", {
    font: selected ? MARKER_FONT : undefined,
  });
}

export function handText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  opts: { font?: string; align?: CanvasTextAlign; outline?: string; angle?: number } = {},
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.angle ?? 0);
  ctx.font = `${size}px ${opts.font ?? HAND_FONT}`;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  if (opts.outline) {
    ctx.strokeStyle = opts.outline;
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.lineJoin = "round";
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
