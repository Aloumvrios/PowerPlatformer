// A forward model of one player action — a launch, or a hold-to-fly for a
// while — replaying the same per-frame rules as Game.update() and
// moveAndCollide() (gravity, one-way platforms, ground skid, hazards,
// patrolling enemies, pickups, the goal). Bots use it to "imagine" where an
// action would take them before committing to it, the way a player eyeballs
// a jump. It's an estimate: execution noise is applied afterwards, so the
// real outcome can differ.
import {
  FLY_GRAVITY_MULT,
  FLY_HOLD_VX_SPEED,
  FLY_HOLD_VY_SPEED,
  FLY_MIN_Y,
  GRAVITY,
  GROUND_FRICTION,
  stepEnemy,
} from "../game";
import type { Level, Rect } from "../types";

const DT = 1 / 60;

export type Outcome = "landed" | "goal" | "hazard" | "enemy" | "fell" | "timeout";

export interface ForwardStart {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface ForwardAction {
  // Velocity set by a launch on the first frame (ignored while flying).
  launch?: { vx: number; vy: number };
  // Hold to fly for `sec`, steering left/right/straight up — straight up
  // for the first `upSec` of it, if given (fly up, then over to a ledge).
  fly?: { sec: number; dirX: -1 | 0 | 1; upSec?: number; farting: number; netCostPerSec: number };
  flyPowerSec: number; // remaining fly power-up time (slow fall), 0 if none
  maxSec: number;
}

export interface ForwardResult {
  outcome: Outcome;
  t: number;
  x: number; // player centre where it ended
  cy: number;
  bottom: number;
  beans: number[];
  bananas: number[];
  powerUps: number[];
  edgeMargin: number; // how far from the platform's edge it came to rest
}

function hits(ax: number, ay: number, aw: number, ah: number, b: Rect): boolean {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function simulateAction(level: Readonly<Level>, start: ForwardStart, action: ForwardAction): ForwardResult {
  let { x, y, vx, vy, onGround } = start;
  const { w, h } = start;
  const enemies = level.enemies.filter((e) => e.alive).map((e) => ({ ...e }));
  const beans: number[] = [];
  const bananas: number[] = [];
  const powerUps: number[] = [];
  let farting = action.fly?.farting ?? 0;
  let t = 0;
  let launched = false;
  let landedOn: Rect | null = null;

  const result = (outcome: Outcome): ForwardResult => ({
    outcome,
    t,
    x: x + w / 2,
    cy: y + h / 2,
    bottom: y + h,
    beans,
    bananas,
    powerUps,
    edgeMargin: landedOn ? Math.min(x + w / 2 - landedOn.x, landedOn.x + landedOn.w - (x + w / 2)) : 0,
  });

  while (t < action.maxSec) {
    const poweredFly = t < action.flyPowerSec;
    const fly = action.fly;
    const holding = !!fly && t < fly.sec && farting > 0;
    if (holding) {
      vx = (t < (fly.upSec ?? 0) ? 0 : fly.dirX) * FLY_HOLD_VX_SPEED;
      vy = -FLY_HOLD_VY_SPEED;
      onGround = false;
      farting -= fly.netCostPerSec * DT;
    } else {
      vy += GRAVITY * (poweredFly ? FLY_GRAVITY_MULT : 1) * DT;
      if (action.launch && !launched) {
        vx = action.launch.vx;
        vy = action.launch.vy;
        onGround = false;
        launched = true;
      } else if (onGround) {
        const slow = GROUND_FRICTION * DT;
        vx = Math.abs(vx) <= slow ? 0 : vx - Math.sign(vx) * slow;
      }
    }

    // moveAndCollide: x then y against solids, then one-way platforms.
    const prevBottom = y + h;
    x += vx * DT;
    if (x < 0 || x > level.widthPx - w) {
      x = Math.max(0, Math.min(x, level.widthPx - w));
      vx = 0;
    }
    for (const s of level.solids) {
      if (vx === 0 || !hits(x, y, w, h, s)) continue;
      x = vx > 0 ? s.x - w : s.x + s.w;
      vx = 0;
    }
    y += vy * DT;
    if (poweredFly || holding) y = Math.max(FLY_MIN_Y, y);
    const wasGround = onGround;
    onGround = false;
    for (const s of level.solids) {
      if (vy === 0 || !hits(x, y, w, h, s)) continue;
      if (vy > 0) {
        y = s.y - h;
        onGround = true;
        landedOn = s;
      } else {
        y = s.y + s.h;
      }
      vy = 0;
    }
    if (!onGround && vy >= 0) {
      let landY = Infinity;
      let on: Rect | null = null;
      for (const p of level.platforms) {
        if (!(x + w > p.x && x < p.x + p.w)) continue;
        if (prevBottom <= p.y + 0.5 && y + h >= p.y && p.y < landY) {
          landY = p.y;
          on = p;
        }
      }
      if (on) {
        y = landY - h;
        vy = 0;
        onGround = true;
        landedOn = on;
      }
    }
    t += DT;

    for (const hz of level.hazards) if (hits(x, y, w, h, hz)) return result("hazard");
    for (const e of enemies) {
      stepEnemy(e, DT);
      if (hits(x, y, w, h, e)) return result("enemy");
    }
    level.powerUps.forEach((pu, i) => {
      if (!pu.collected && !powerUps.includes(i) && hits(x, y, w, h, pu)) powerUps.push(i);
    });
    // Beans and bananas use the game's slightly generous grab box.
    const gx = x - 6;
    const gy = y - 6;
    level.beans.forEach((b, i) => {
      if (!b.collected && !beans.includes(i) && hits(gx, gy, w + 12, h + 12, b)) beans.push(i);
    });
    level.bananas.forEach((b, i) => {
      if (!b.collected && !bananas.includes(i) && hits(gx, gy, w + 12, h + 12, b)) bananas.push(i);
    });
    if (hits(x, y, w, h, level.goal)) return result("goal");
    if (y > level.heightPx + 80) return result("fell");
    // At rest on a platform after the action has played out.
    if (onGround && wasGround && vx === 0 && (!fly || t >= fly.sec || farting <= 0)) return result("landed");
  }
  return result("timeout");
}
