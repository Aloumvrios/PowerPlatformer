// A scripted player that drives the Game through the same InputSource a
// real mouse/touchscreen does: single taps, double taps, holds and swipes.
//
// Each time it's ready to act (landed, and done hesitating) it imagines a
// fan of candidate actions with the forward model, scores them by its
// persona (progress toward the toilet, pickups, gas cost, risk), picks one,
// and then performs it with human-ish aim and timing error.
import { ATTACK_RANGE, DEPLETED_ATTACK_RANGE_MULT, DEPLETED_JUMP_MULT, DEPLETED_SPEED_MULT, FLY_HOLD_DEADZONE_PX, INPUT_GRACE_SEC, JUMP_BOOST_SPEED, JUMP_SPEED, SPEED_BOOST_MULT, WEAK_LAUNCH_SPEED, type Game } from "../game";
import type { InputSource, Point } from "../input";
import { distanceToGoal } from "../nav";
import type { Tuning } from "../tuning";
import { simulateAction, type ForwardResult } from "./forward";
import type { Persona } from "./personas";
import { Rng } from "./rng";

const ANGLES = Array.from({ length: 19 }, (_, i) => -Math.PI + (i * Math.PI) / 18); // left .. up .. right
const FLY_SECS = [0.4, 0.8, 1.3, 1.9, 2.6];
const MAX_PLAN_SEC = 2.6;
const ROBUST_TOP_K = 6;

type Plan =
  | { kind: "launch"; tier: "weak" | "strong"; angle: number }
  | { kind: "fly"; dirX: -1 | 0 | 1; sec: number; upSec?: number }; // straight up for upSec, then steer

type Mode = "idle" | "awaitLaunch" | "flying" | "airborne";

export class Agent implements InputSource {
  private clickTarget: Point | null = null;
  private jumpTarget: Point | null = null;
  private attackDir: 1 | -1 | null = null;
  private flyTarget: Point | null = null;

  private mode: Mode = "idle";
  private timer = 0;
  private flyDirX: -1 | 0 | 1 = 0;
  private flyUpSec = 0; // planned straight-up part of the current hold
  private flyElapsed = 0;
  private tapAcc = 0; // fractional taps owed while mashing through a stall
  private wasStalled = false;
  private flyEngaged = false;
  private lastFurthest = 0;
  private stuckSec = 0;
  private attackDecided = new Set<number>(); // enemies we've already chosen to attack or not
  private attackChoice = new Map<number, boolean>();

  constructor(
    private game: Game,
    private persona: Persona,
    private tuning: Tuning,
    private rng: Rng,
  ) {}

  reset(): void {
    this.clickTarget = this.jumpTarget = this.flyTarget = null;
    this.attackDir = null;
    this.mode = "idle";
    this.timer = this.think();
    this.lastFurthest = 0;
    this.stuckSec = 0;
    this.attackDecided.clear();
    this.attackChoice.clear();
  }

  // --- InputSource ------------------------------------------------------------

  consumeClickTarget(): Point | null {
    const p = this.clickTarget;
    this.clickTarget = null;
    return p;
  }
  consumeJump(): Point | null {
    const p = this.jumpTarget;
    this.jumpTarget = null;
    return p;
  }
  consumeAttack(): 1 | -1 | null {
    const d = this.attackDir;
    this.attackDir = null;
    return d;
  }
  getFlyTarget(): Point | null {
    return this.flyTarget;
  }
  consumeAnyAction(): boolean {
    const had = this.clickTarget !== null || this.jumpTarget !== null || this.attackDir !== null;
    this.clickTarget = this.jumpTarget = null;
    this.attackDir = null;
    return had;
  }

  // --- behaviour ---------------------------------------------------------------

  private think(): number {
    const [a, b] = this.persona.thinkSec;
    return this.rng.range(a, b);
  }

  // Called once per frame, before game.tick().
  update(dt: number): void {
    const g = this.game;
    if (g.currentStatus !== "playing") {
      this.flyTarget = null;
      if (g.currentStatus === "dying") this.mode = "idle";
      return;
    }
    if (g.timeInStatus < INPUT_GRACE_SEC + 0.02) return;
    const p = g.playerState;

    // Stuck = no new ground covered along the route for a while.
    const furthest = g.runSummary.progress;
    if (furthest > this.lastFurthest + 0.005) {
      this.lastFurthest = furthest;
      this.stuckSec = 0;
    } else {
      this.stuckSec += dt;
    }

    // Held up by a stall: mash taps to hurry it along (it never launches
    // anyone), then take a moment before moving on.
    if (g.stalled) {
      this.flyTarget = null;
      this.tapAcc += dt * this.persona.tapRate;
      if (this.tapAcc >= 1) {
        this.tapAcc -= 1;
        this.clickTarget = this.screenCenter();
      }
      this.wasStalled = true;
      return;
    }
    if (this.wasStalled) {
      this.wasStalled = false;
      this.tapAcc = 0;
      this.toIdle();
    }

    this.maybeAttack();

    switch (this.mode) {
      case "idle":
        this.timer -= dt;
        if (this.timer <= 0 && p.onGround) this.act();
        break;
      case "awaitLaunch":
        this.timer -= dt;
        if (!p.onGround) this.toAirborne();
        else if (this.timer <= 0) this.toIdle();
        break;
      case "flying":
        this.timer -= dt;
        this.flyElapsed += dt;
        this.flyTarget = this.flyPoint();
        if (g.holdFlying) this.flyEngaged = true;
        // Let go when the planned hold is over, or when the tank ran dry
        // and the game forced a landing.
        if (this.timer <= 0 || (this.flyEngaged && !g.holdFlying)) {
          this.flyTarget = null;
          this.toAirborne();
        }
        break;
      case "airborne":
        if (p.onGround) this.toIdle();
        else if (g.hasPower("fly")) {
          // With wings, launches work mid-air too.
          this.timer -= dt;
          if (this.timer <= 0) this.act();
        }
        break;
    }
  }

  private toAirborne(): void {
    this.mode = "airborne";
    this.timer = this.think();
  }

  private toIdle(): void {
    this.mode = "idle";
    this.timer = this.think();
  }

  private screenCenter(): Point {
    const p = this.game.playerState;
    const cam = this.game.camera;
    return { x: p.x + p.w / 2 - cam.x, y: p.y + p.h / 2 - cam.y };
  }

  private flyPoint(): Point {
    const c = this.screenCenter();
    const dir = this.flyElapsed < this.flyUpSec ? 0 : this.flyDirX;
    return { x: c.x + dir * (FLY_HOLD_DEADZONE_PX + 60), y: c.y - 60 };
  }

  private launchSpeed(tier: "weak" | "strong"): number {
    const g = this.game;
    const depleted = g.farting <= 0;
    if (tier === "weak") {
      const base = WEAK_LAUNCH_SPEED * (g.hasPower("speed") ? SPEED_BOOST_MULT : 1);
      return depleted ? base * DEPLETED_SPEED_MULT : base;
    }
    const base = g.hasPower("jump") ? JUMP_BOOST_SPEED : JUMP_SPEED;
    return depleted ? base * DEPLETED_JUMP_MULT : base;
  }

  // Swipe at an enemy that's in reach, if this persona is the type to.
  private maybeAttack(): void {
    const g = this.game;
    if (!g.attackReady || g.invulnerable) return;
    const p = g.playerState;
    const range = ATTACK_RANGE * (g.farting <= 0 ? DEPLETED_ATTACK_RANGE_MULT : 1) * 0.85;
    g.currentLevel.enemies.forEach((e, i) => {
      if (!e.alive || this.attackDir !== null) return;
      const vOverlap = p.y < e.y + e.h && p.y + p.h > e.y;
      const gapRight = e.x - (p.x + p.w);
      const gapLeft = p.x - (e.x + e.w);
      const near = vOverlap && (gapRight < range * 2.5 && gapLeft < range * 2.5);
      if (!near) return;
      if (!this.attackDecided.has(i)) {
        this.attackDecided.add(i);
        this.attackChoice.set(i, this.rng.next() < this.persona.aggression);
      }
      if (!this.attackChoice.get(i)) return;
      if (gapRight >= -4 && gapRight < range) this.attackDir = 1;
      else if (gapLeft >= -4 && gapLeft < range) this.attackDir = -1;
    });
  }

  private act(): void {
    const plan = this.choose();
    const c = this.screenCenter();
    if (plan.kind === "fly") {
      const timing = Math.max(0.3, 1 + this.rng.normal() * this.persona.holdNoise);
      this.flyDirX = plan.dirX;
      this.flyUpSec = (plan.upSec ?? 0) * timing;
      this.flyElapsed = 0;
      this.flyTarget = this.flyPoint();
      this.flyEngaged = false;
      this.timer = Math.max(0.2, plan.sec * timing);
      this.mode = "flying";
      return;
    }
    const angle = plan.angle + this.rng.normal() * this.persona.aimNoise;
    const target = { x: c.x + Math.cos(angle) * 150, y: c.y + Math.sin(angle) * 150 };
    if (plan.tier === "strong" && this.rng.next() >= this.persona.doubleTapMiss) this.jumpTarget = target;
    else this.clickTarget = target;
    this.mode = "awaitLaunch";
    this.timer = 0.4;
  }

  private choose(): Plan {
    const g = this.game;
    const p = g.playerState;
    const level = g.currentLevel;
    const start = { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround };
    const flyPowerSec = g.activePowerState.get("fly")?.remainingSec ?? 0;
    const persona = this.persona;
    // This decision's misreading of how far things carry: the plan is the
    // best one *as they see it*, then performed for real.
    const belief = Math.max(0.5, 1 + this.rng.normal() * persona.misjudge);

    const run = (plan: Plan, angleOffset = 0, holdScale = 1): ForwardResult => {
      if (plan.kind === "fly") {
        return simulateAction(level, start, {
          fly: {
            sec: plan.sec * holdScale * belief,
            upSec: (plan.upSec ?? 0) * holdScale * belief,
            dirX: plan.dirX,
            farting: g.farting,
            netCostPerSec: this.tuning.fartingFlyCostPerSec - this.tuning.fartingRegenPerSec,
          },
          flyPowerSec,
          maxSec: plan.sec * holdScale + MAX_PLAN_SEC,
        });
      }
      const speed = this.launchSpeed(plan.tier) * Math.sqrt(belief);
      const a = plan.angle + angleOffset;
      return simulateAction(level, start, {
        launch: { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed },
        flyPowerSec,
        maxSec: MAX_PLAN_SEC,
      });
    };

    const plans: Plan[] = [];
    for (const angle of ANGLES) {
      plans.push({ kind: "launch", tier: "weak", angle });
      plans.push({ kind: "launch", tier: "strong", angle });
    }
    const stuck = this.stuckSec > 6;
    if (g.farting > 15 && (stuck || this.rng.next() < persona.flyiness)) {
      for (const sec of FLY_SECS) {
        plans.push({ kind: "fly", dirX: 1, sec });
        plans.push({ kind: "fly", dirX: -1, sec });
        plans.push({ kind: "fly", dirX: 0, sec: sec * 0.6 });
      }
      // Fly up, then steer over to one side (onto a ledge, out of a shaft).
      for (const upSec of [0.6, 1.0, 1.4, 1.8])
        for (const steer of [0.25, 0.5])
          for (const dirX of [-1, 1] as const) plans.push({ kind: "fly", dirX, upSec, sec: upSec + steer });
    }

    const scored = plans.map((plan) => ({ plan, res: run(plan), score: 0 }));
    const fromDist = distanceToGoal(level, p.x + p.w / 2, p.y + p.h / 2);
    for (const s of scored) s.score = this.score(s.plan, s.res, fromDist);
    scored.sort((a, b) => b.score - a.score);

    // Would it still work with a slightly worse aim / hold? Penalise the
    // "only just" options, more for careful players.
    for (const s of scored.slice(0, ROBUST_TOP_K)) {
      if (s.score === -Infinity) continue;
      const spread = Math.max(0.04, persona.aimNoise * 1.2);
      const variants =
        s.plan.kind === "fly"
          ? [run(s.plan, 0, 1 - Math.max(0.1, persona.holdNoise)), run(s.plan, 0, 1 + Math.max(0.1, persona.holdNoise))]
          : [run(s.plan, -spread), run(s.plan, spread)];
      const bad = variants.filter((v) => v.outcome !== "landed" && v.outcome !== "goal").length;
      s.score -= bad * 4 * persona.caution;
    }
    scored.sort((a, b) => b.score - a.score);

    // Mostly the best option, but sometimes just a decent one.
    const viable = scored.filter((s) => s.score > -Infinity);
    if (viable.length === 0) return { kind: "launch", tier: "weak", angle: -Math.PI / 2 };
    if (this.rng.next() < persona.fumble) return viable[Math.floor(this.rng.next() * viable.length)].plan;
    const best = viable[0].score;
    const pool = viable.filter((s) => s.score >= best - 2 * persona.randomness).slice(0, 1 + Math.round(4 * persona.randomness));
    return pool[Math.floor(this.rng.next() * pool.length)].plan;
  }

  private score(plan: Plan, res: ForwardResult, fromDist: number): number {
    const g = this.game;
    const persona = this.persona;
    const t = this.tuning;
    if (res.outcome === "hazard" || res.outcome === "fell" || res.outcome === "timeout") return -Infinity;
    if (res.outcome === "enemy" && !g.hasPower("shield")) return -Infinity;

    // Progress toward the toilet, measured along the level's route.
    let score = (fromDist - distanceToGoal(g.currentLevel, res.x, res.cy)) / 60;
    if (res.outcome === "goal") score += 100;
    if (res.outcome === "landed") score += Math.min(res.edgeMargin, 30) / 30 * 0.5 * persona.caution;

    // Pickups. People who get the meters weigh beans against the clock
    // and value bananas more as Holding Power runs low.
    const holdNeed = 1 - g.holding / 100;
    const gasNeed = 1 - g.farting / 100;
    const beanValue = persona.greed * (0.5 + persona.economy * (gasNeed - t.holdingBeanCost * holdNeed * 0.5));
    const bananaValue = persona.greed * 0.8 + persona.economy * holdNeed * 6;
    score += res.beans.length * beanValue + res.bananas.length * bananaValue;
    for (const i of res.powerUps) {
      const kind = g.currentLevel.powerUps[i].kind;
      score += kind === "beansoup" ? persona.greed * 0.5 + persona.economy * (gasNeed * 4 - holdNeed * 3) : persona.greed * 1.2 + 0.5;
    }

    // Gas cost, felt more when the tank is low.
    const gasCost =
      plan.kind === "fly"
        ? (t.fartingFlyCostPerSec - t.fartingRegenPerSec) * plan.sec
        : plan.tier === "strong"
          ? t.fartingJumpCost
          : t.fartingWeakLaunchCost;
    score -= (gasCost / 25) * persona.economy * (0.5 + gasNeed);
    if (res.outcome === "stall" && res.stall) {
      // Getting caught costs time; how much that matters depends on the clock.
      // Expected length given how fast this persona mashes to hurry it.
      const full = t.stallNpcSec;
      const expected = Math.max(full * 0.4, full / (1 + 0.3 * persona.tapRate));
      score -= expected * (0.2 + persona.economy * (0.5 + holdNeed * 1.5));
    }
    // Time spent, felt more as Holding Power runs low.
    score -= res.t * (0.2 + holdNeed * persona.economy * 1.5);
    return score;
  }
}
